#include <node_api.h>
#include <atomic>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>

#ifdef _WIN32
#include <windows.h>

static std::atomic<unsigned> ownerCount{0};
static bool ReserveOwner() {
  unsigned current = ownerCount.load();
  while (current < 32) {
    if (ownerCount.compare_exchange_weak(current, current + 1)) return true;
  }
  return false;
}

static void Close(HANDLE& handle) {
  if (handle && handle != INVALID_HANDLE_VALUE) CloseHandle(handle);
  handle = nullptr;
}

static bool CloseChecked(HANDLE& handle) {
  if (!handle || handle == INVALID_HANDLE_VALUE) return false;
  if (!CloseHandle(handle)) return false;
  handle = nullptr;
  return true;
}

struct Owner {
#ifdef SA_OWNER_TEST
  bool delayWrite = false;
#endif
  HANDLE job = nullptr;
  HANDLE process = nullptr;
  HANDLE input = nullptr;
  HANDLE output = nullptr;
  std::atomic<bool> stopping{false};
  std::atomic<bool> reading{false};
  std::atomic<bool> writing{false};
  std::atomic<bool> counted{true};
  std::mutex ioLock;
  HANDLE readerThread = nullptr;
  HANDLE writerThread = nullptr;
  void ReleaseSlot() { if (counted.exchange(false)) ownerCount.fetch_sub(1); }
  ~Owner() {
    if (job) { TerminateJobObject(job, 1); Close(job); }
    Close(process); Close(input); Close(output);
    ReleaseSlot();
  }
};

struct Operation {
  napi_threadsafe_function signal{};
  napi_deferred promise{};
  napi_ref ownerRef{};
  Owner* owner = nullptr;
  enum Kind { Write, Read, Stop } kind{};
  std::vector<unsigned char> bytes;
  bool success = false;
  bool eof = false;
};

static bool RegisterIoThread(Owner* owner, bool reader) {
  HANDLE thread = nullptr;
  if (!DuplicateHandle(GetCurrentProcess(), GetCurrentThread(), GetCurrentProcess(), &thread, 0, FALSE, DUPLICATE_SAME_ACCESS)) return false;
  std::lock_guard<std::mutex> guard(owner->ioLock);
  if (owner->stopping.load()) { Close(thread); return false; }
  if (reader) owner->readerThread = thread;
  else owner->writerThread = thread;
  return true;
}

static void ReleaseIoThread(Owner* owner, bool reader) {
  std::lock_guard<std::mutex> guard(owner->ioLock);
  if (reader) { Close(owner->readerThread); owner->reading.store(false); }
  else { Close(owner->writerThread); owner->writing.store(false); }
}

static DWORD WINAPI WatchWrite(void* raw) {
  HANDLE thread = static_cast<HANDLE>(raw);
  if (WaitForSingleObject(thread, 4000) == WAIT_TIMEOUT) {
    while (WaitForSingleObject(thread, 50) == WAIT_TIMEOUT) CancelSynchronousIo(thread);
  }
  CloseHandle(thread);
  return 0;
}

static bool StartWriteWatchdog(Owner* owner) {
  HANDLE observed = nullptr;
  {
    std::lock_guard<std::mutex> guard(owner->ioLock);
    if (!owner->writerThread || !DuplicateHandle(GetCurrentProcess(), owner->writerThread,
        GetCurrentProcess(), &observed, 0, FALSE, DUPLICATE_SAME_ACCESS)) return false;
  }
  HANDLE watchdog = CreateThread(nullptr, 0, WatchWrite, observed, 0, nullptr);
  if (!watchdog) { Close(observed); return false; }
  Close(watchdog);
  return true;
}

static bool String(napi_env env, napi_value value, std::wstring& result, size_t maximum) {
  size_t length = 0;
  if (napi_get_value_string_utf16(env, value, nullptr, 0, &length) != napi_ok || length > maximum) return false;
  std::vector<char16_t> buffer(length + 1);
  size_t actual = 0;
  if (napi_get_value_string_utf16(env, value, buffer.data(), buffer.size(), &actual) != napi_ok || actual != length) return false;
  result.clear();
  for (size_t i = 0; i < length; ++i) {
    if (buffer[i] == 0) return false;
    result.push_back(static_cast<wchar_t>(buffer[i]));
  }
  return true;
}

static bool AbsoluteLocal(const std::wstring& value) {
  return value.size() >= 3 && ((value[0] >= L'A' && value[0] <= L'Z') || (value[0] >= L'a' && value[0] <= L'z'))
    && value[1] == L':' && (value[2] == L'\\' || value[2] == L'/');
}

static std::wstring Quote(const std::wstring& value) {
  std::wstring out = L"\"";
  size_t slashes = 0;
  for (wchar_t ch : value) {
    if (ch == L'\\') { ++slashes; continue; }
    if (ch == L'\"') { out.append(slashes * 2 + 1, L'\\'); out.push_back(ch); }
    else { out.append(slashes, L'\\'); out.push_back(ch); }
    slashes = 0;
  }
  out.append(slashes * 2, L'\\');
  out.push_back(L'\"');
  return out;
}

static std::vector<wchar_t> Environment() {
  std::vector<std::wstring> items;
  for (const wchar_t* name : { L"PATH", L"SystemRoot", L"TEMP", L"TMP" }) {
    DWORD length = GetEnvironmentVariableW(name, nullptr, 0);
    if (!length || length > 32767) continue;
    std::vector<wchar_t> value(length);
    DWORD actual = GetEnvironmentVariableW(name, value.data(), length);
    if (!actual || actual >= length) continue;
    items.emplace_back(std::wstring(name) + L"=" + std::wstring(value.data(), actual));
  }
  std::vector<wchar_t> result;
  for (const auto& item : items) { result.insert(result.end(), item.begin(), item.end()); result.push_back(0); }
  result.push_back(0);
  if (result.size() == 1) result.push_back(0);
  return result;
}

static void Execute(napi_env, void* raw) {
  Operation* op = static_cast<Operation*>(raw);
  Owner* owner = op->owner;
  if (op->kind == Operation::Write) {
    if (!RegisterIoThread(owner, false)) { owner->writing.store(false); return; }
    if (!StartWriteWatchdog(owner)) { ReleaseIoThread(owner, false); return; }
    const ULONGLONG deadline = GetTickCount64() + 4000;
#ifdef SA_OWNER_TEST
    if (owner->delayWrite) Sleep(4500);
#endif
    size_t offset = 0;
    while (offset < op->bytes.size()) {
      if (owner->stopping.load() || GetTickCount64() >= deadline) break;
      DWORD written = 0;
      DWORD size = static_cast<DWORD>(op->bytes.size() - offset);
      if (!WriteFile(owner->input, op->bytes.data() + offset, size, &written, nullptr) || !written) break;
      offset += written;
    }
    op->success = offset == op->bytes.size();
    ReleaseIoThread(owner, false);
  } else if (op->kind == Operation::Read) {
    if (!RegisterIoThread(owner, true)) { owner->reading.store(false); return; }
    const ULONGLONG deadline = GetTickCount64() + 1000;
    bool idle = true;
    while (!owner->stopping.load() && GetTickCount64() < deadline) {
      DWORD available = 0;
      if (!PeekNamedPipe(owner->output, nullptr, 0, nullptr, &available, nullptr)) {
        idle = false;
        op->eof = GetLastError() == ERROR_BROKEN_PIPE;
        op->success = op->eof;
        break;
      }
      if (available > 0) {
        idle = false;
        op->bytes.resize(available < 12288 ? available : 12288);
        DWORD actual = 0;
        if (ReadFile(owner->output, op->bytes.data(), static_cast<DWORD>(op->bytes.size()), &actual, nullptr) && actual > 0) {
          op->bytes.resize(actual); op->success = true;
        } else {
          SecureZeroMemory(op->bytes.data(), op->bytes.size());
          op->bytes.clear();
          op->eof = GetLastError() == ERROR_BROKEN_PIPE;
          op->success = op->eof;
        }
        break;
      }
      Sleep(25);
    }
    if (!owner->stopping.load() && idle && GetTickCount64() >= deadline) op->success = true;
    ReleaseIoThread(owner, true);
  } else {
    if (!owner->job || !TerminateJobObject(owner->job, 1)) return;
    ULONGLONG deadline = GetTickCount64() + 15000;
    while (GetTickCount64() < deadline) {
      {
        std::lock_guard<std::mutex> guard(owner->ioLock);
        if (owner->readerThread) CancelSynchronousIo(owner->readerThread);
        if (owner->writerThread) CancelSynchronousIo(owner->writerThread);
      }
      JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting{};
      if (!QueryInformationJobObject(owner->job, JobObjectBasicAccountingInformation, &accounting, sizeof(accounting), nullptr)) return;
      if (accounting.ActiveProcesses == 0 && !owner->reading.load() && !owner->writing.load()) {
        const ULONGLONG now = GetTickCount64();
        if (!owner->process || now >= deadline
            || WaitForSingleObject(owner->process, static_cast<DWORD>(deadline - now)) != WAIT_OBJECT_0) return;
        const bool inputClosed = CloseChecked(owner->input);
        const bool outputClosed = CloseChecked(owner->output);
        const bool processClosed = CloseChecked(owner->process);
        if (!inputClosed || !outputClosed || !processClosed) return;
        if (!CloseHandle(owner->job)) return;
        owner->job = nullptr;
        owner->ReleaseSlot();
        op->success = true;
        return;
      }
      Sleep(50);
    }
  }
}

static void Deliver(napi_env env, napi_value, void* raw, void*) {
  Operation* op = static_cast<Operation*>(raw);
  if (!env) return;
  napi_value value{};
  if (op->success) {
    if (op->kind == Operation::Stop) napi_create_string_utf8(env, "TERMINATED", NAPI_AUTO_LENGTH, &value);
    else if (op->kind == Operation::Read && !op->eof && op->bytes.empty()) napi_create_buffer(env, 0, nullptr, &value);
    else if (op->kind == Operation::Read && !op->eof) napi_create_buffer_copy(env, op->bytes.size(), op->bytes.data(), nullptr, &value);
    else if (op->kind == Operation::Read) napi_get_null(env, &value);
    else napi_get_undefined(env, &value);
    napi_resolve_deferred(env, op->promise, value);
  } else {
    napi_value message{}, error{};
    napi_create_string_utf8(env, "Process ownership unavailable", NAPI_AUTO_LENGTH, &message);
    napi_create_error(env, nullptr, message, &error);
    napi_reject_deferred(env, op->promise, error);
  }
}

static void FinalizeOperation(napi_env env, void* raw, void*) {
  Operation* op = static_cast<Operation*>(raw);
  if (!op->bytes.empty()) SecureZeroMemory(op->bytes.data(), op->bytes.size());
  if (env && op->ownerRef) napi_delete_reference(env, op->ownerRef);
  delete op;
}

static DWORD WINAPI Worker(void* raw) {
  Operation* op = static_cast<Operation*>(raw);
  Execute(nullptr, op);
  napi_call_threadsafe_function(op->signal, nullptr, napi_tsfn_nonblocking);
  napi_release_threadsafe_function(op->signal, napi_tsfn_release);
  return 0;
}

static napi_value Rejected(napi_env env) {
  napi_deferred deferred{}; napi_value promise{}, message{}, error{};
  if (napi_create_promise(env, &deferred, &promise) != napi_ok
      || napi_create_string_utf8(env, "Process ownership unavailable", NAPI_AUTO_LENGTH, &message) != napi_ok
      || napi_create_error(env, nullptr, message, &error) != napi_ok) return nullptr;
  napi_reject_deferred(env, deferred, error);
  return promise;
}

static napi_value Queue(napi_env env, napi_callback_info info, Operation::Kind kind) {
  size_t argc = 2;
  napi_value args[2]{}, self{};
  if (napi_get_cb_info(env, info, &argc, args, &self, nullptr) != napi_ok) return nullptr;
  Owner* owner = nullptr;
  if (napi_unwrap(env, self, reinterpret_cast<void**>(&owner)) != napi_ok || !owner) {
    napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr;
  }
  Operation* op = new Operation();
  op->owner = owner; op->kind = kind;
  if (kind == Operation::Write) {
    bool isBuffer = false; void* data = nullptr; size_t size = 0;
    if (argc != 1 || napi_is_buffer(env, args[0], &isBuffer) != napi_ok || !isBuffer
      || napi_get_buffer_info(env, args[0], &data, &size) != napi_ok || size == 0 || size > 1048576) {
      delete op; napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr;
    }
    if (owner->stopping.load() || owner->writing.exchange(true)) { delete op; return Rejected(env); }
    const auto* begin = static_cast<unsigned char*>(data);
    op->bytes.assign(begin, begin + size);
  } else if (argc != 0) {
    delete op; napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr;
  }
  if (kind == Operation::Read && (owner->stopping.load() || owner->reading.exchange(true))) { delete op; return Rejected(env); }
  if (kind == Operation::Stop && owner->stopping.exchange(true)) { delete op; return Rejected(env); }
  napi_value promise{}, name{};
  if (napi_create_reference(env, self, 1, &op->ownerRef) != napi_ok
      || napi_create_promise(env, &op->promise, &promise) != napi_ok
      || napi_create_string_utf8(env, "owned process", NAPI_AUTO_LENGTH, &name) != napi_ok
      || napi_create_threadsafe_function(env, nullptr, nullptr, name, 0, 1, op, FinalizeOperation, op, Deliver, &op->signal) != napi_ok) {
    if (kind == Operation::Read) owner->reading.store(false);
    if (kind == Operation::Write) owner->writing.store(false);
    if (kind == Operation::Stop && owner->job) TerminateJobObject(owner->job, 1);
    if (op->ownerRef) napi_delete_reference(env, op->ownerRef);
    if (!op->bytes.empty()) SecureZeroMemory(op->bytes.data(), op->bytes.size());
    delete op; napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr;
  }
  HANDLE thread = CreateThread(nullptr, 0, Worker, op, 0, nullptr);
  if (thread) CloseHandle(thread);
  else {
    if (kind == Operation::Read) owner->reading.store(false);
    if (kind == Operation::Write) owner->writing.store(false);
    if (kind == Operation::Stop && owner->job) TerminateJobObject(owner->job, 1);
    napi_call_threadsafe_function(op->signal, nullptr, napi_tsfn_nonblocking);
    napi_release_threadsafe_function(op->signal, napi_tsfn_release);
  }
  return promise;
}

static napi_value Write(napi_env e, napi_callback_info i) { return Queue(e, i, Operation::Write); }
static napi_value Read(napi_env e, napi_callback_info i) { return Queue(e, i, Operation::Read); }
static napi_value Stop(napi_env e, napi_callback_info i) { return Queue(e, i, Operation::Stop); }
static void Finalize(napi_env, void* value, void*) { delete static_cast<Owner*>(value); }

static napi_value Start(napi_env env, napi_callback_info info) {
  size_t argc = 4;
  napi_value args[4]{};
  std::wstring executable, cwd;
  bool array = false; uint32_t count = 0;
  if (napi_get_cb_info(env, info, &argc, args, nullptr, nullptr) != napi_ok || argc != 3
      || !String(env, args[0], executable, 8192) || !AbsoluteLocal(executable)
      || napi_is_array(env, args[1], &array) != napi_ok || !array
      || napi_get_array_length(env, args[1], &count) != napi_ok || count > 64
      || !String(env, args[2], cwd, 8192) || !AbsoluteLocal(cwd)) {
    napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr;
  }
  std::wstring command = Quote(executable);
  for (uint32_t i = 0; i < count; ++i) {
    napi_value item{}; std::wstring argument;
    if (napi_get_element(env, args[1], i, &item) != napi_ok || !String(env, item, argument, 8192)) {
      napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr;
    }
    command += L" " + Quote(argument);
  }
  if (command.size() > 32766) { napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr; }
  napi_value result{};
  napi_property_descriptor properties[] = {
    { "write", nullptr, Write, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "read", nullptr, Read, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "stop", nullptr, Stop, nullptr, nullptr, nullptr, napi_default, nullptr }
  };
  if (napi_create_object(env, &result) != napi_ok
      || napi_define_properties(env, result, sizeof(properties) / sizeof(properties[0]), properties) != napi_ok) {
    napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr;
  }
  if (!ReserveOwner()) { napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr; }
  Owner* owner = new Owner();
#ifdef SA_OWNER_TEST
  wchar_t testDelay[2]{};
  owner->delayWrite = GetEnvironmentVariableW(L"SA_OWNER_TEST_DELAY", testDelay, 2) == 1 && testDelay[0] == L'1';
#endif
  HANDLE childIn = nullptr, childOut = nullptr, childError = nullptr;
  LPPROC_THREAD_ATTRIBUTE_LIST attributes = nullptr;
  bool attributesReady = false;
  PROCESS_INFORMATION process{};
  bool success = false;
  do {
    owner->job = CreateJobObjectW(nullptr, nullptr);
    if (!owner->job) break;
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if (!SetInformationJobObject(owner->job, JobObjectExtendedLimitInformation, &limits, sizeof(limits))) break;
    SIZE_T bytes = 0;
    InitializeProcThreadAttributeList(nullptr, 2, 0, &bytes);
    if (!bytes || bytes > 1048576) break;
    attributes = static_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(HeapAlloc(GetProcessHeap(), 0, bytes));
    if (!attributes || !InitializeProcThreadAttributeList(attributes, 2, 0, &bytes)) break;
    attributesReady = true;
    if (!UpdateProcThreadAttribute(attributes, 0, PROC_THREAD_ATTRIBUTE_JOB_LIST, &owner->job, sizeof(owner->job), nullptr, nullptr)) break;
    SECURITY_ATTRIBUTES security{sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE};
    if (!CreatePipe(&childIn, &owner->input, &security, 0) || !CreatePipe(&owner->output, &childOut, &security, 0)) break;
    childError = CreateFileW(L"NUL", GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, &security, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (!childError || childError == INVALID_HANDLE_VALUE) break;
    if (!SetHandleInformation(owner->input, HANDLE_FLAG_INHERIT, 0) || !SetHandleInformation(owner->output, HANDLE_FLAG_INHERIT, 0)) break;
    HANDLE inherited[] = { childIn, childOut, childError };
    if (!UpdateProcThreadAttribute(attributes, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST, inherited, sizeof(inherited), nullptr, nullptr)) break;
    STARTUPINFOEXW startup{};
    startup.StartupInfo.cb = sizeof(startup); startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    startup.StartupInfo.hStdInput = childIn; startup.StartupInfo.hStdOutput = childOut; startup.StartupInfo.hStdError = childError;
    startup.lpAttributeList = attributes;
    auto environment = Environment();
    std::vector<wchar_t> mutableCommand(command.begin(), command.end());
    mutableCommand.push_back(0);
    if (!CreateProcessW(executable.c_str(), mutableCommand.data(), nullptr, nullptr, TRUE,
          CREATE_SUSPENDED | CREATE_NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT,
          environment.data(), cwd.c_str(), &startup.StartupInfo, &process)) break;
    Close(childIn); Close(childOut); Close(childError);
    BOOL inJob = FALSE;
    if (!IsProcessInJob(process.hProcess, owner->job, &inJob) || !inJob || ResumeThread(process.hThread) == DWORD(-1)) break;
    owner->process = process.hProcess; process.hProcess = nullptr;
    success = true;
  } while (false);
  Close(childIn); Close(childOut); Close(childError);
  if (!success && process.hProcess) TerminateProcess(process.hProcess, 1);
  Close(process.hThread); Close(process.hProcess);
  if (attributesReady) DeleteProcThreadAttributeList(attributes);
  if (attributes) HeapFree(GetProcessHeap(), 0, attributes);
  if (!success) { delete owner; napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr; }
  if (napi_wrap(env, result, owner, Finalize, nullptr, nullptr) != napi_ok) {
    delete owner; napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr;
  }
  return result;
}

#else
static napi_value Start(napi_env env, napi_callback_info) {
  napi_throw_error(env, nullptr, "Process ownership unavailable"); return nullptr;
}
#endif

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor property = { "start", nullptr, Start, nullptr, nullptr, nullptr, napi_default, nullptr };
  napi_define_properties(env, exports, 1, &property);
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
