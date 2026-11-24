#include <node_api.h>
#include <cstring>
#include <string>

#ifdef _WIN32
#include <windows.h>
#include <wincred.h>
#include <bcrypt.h>
#endif

enum class Operation { Create, Read, Cleanup };
struct Work {
  napi_env env{};
  napi_async_work work{};
  napi_deferred promise{};
  Operation operation{};
  std::string reference;
  unsigned char key[32]{};
  bool success = false;
  bool missing = false;
  bool cleaned = false;
};

static void Erase(void* data, size_t size) {
  volatile unsigned char* p = static_cast<volatile unsigned char*>(data);
  while (size--) *p++ = 0;
}

#ifdef _WIN32
static bool ReadKey(const std::wstring& target, unsigned char* key, bool& missing) {
  PCREDENTIALW credential = nullptr;
  if (!CredReadW(target.c_str(), CRED_TYPE_GENERIC, 0, &credential)) {
    missing = GetLastError() == ERROR_NOT_FOUND;
    return false;
  }
  bool valid = credential && credential->CredentialBlob && credential->CredentialBlobSize == 32;
  if (valid) std::memcpy(key, credential->CredentialBlob, 32);
  if (credential) {
    if (credential->CredentialBlob && credential->CredentialBlobSize == 32) SecureZeroMemory(credential->CredentialBlob, 32);
    CredFree(credential);
  }
  return valid;
}

static void Execute(napi_env, void* value) {
  Work* w = static_cast<Work*>(value);
  std::wstring reference(w->reference.begin(), w->reference.end());
#ifdef SA_WINCRED_TEST
  std::wstring target = L"SuperAssistant/TestAddon/" + reference;
#else
  std::wstring target = L"SuperAssistant/ProtectedPayload/" + reference;
#endif
  std::wstring lockName = L"Global\\SuperAssistant-WinCred-" + reference;
  HANDLE mutex = CreateMutexW(nullptr, FALSE, lockName.c_str());
  if (!mutex) return;
  DWORD held = WaitForSingleObject(mutex, 7000);
  if (held != WAIT_OBJECT_0) {
    if (held == WAIT_ABANDONED) ReleaseMutex(mutex);
    CloseHandle(mutex);
    return;
  }
  unsigned char existing[32]{};
  bool missing = false;
  bool found = ReadKey(target, existing, missing);
  if (w->operation == Operation::Read) {
    if (found) { std::memcpy(w->key, existing, 32); w->success = true; }
    else if (missing) { w->missing = true; w->success = true; }
  } else if (w->operation == Operation::Create) {
    if (!found && missing && BCryptGenRandom(nullptr, w->key, 32, BCRYPT_USE_SYSTEM_PREFERRED_RNG) == 0) {
      CREDENTIALW credential{};
      credential.Type = CRED_TYPE_GENERIC;
      credential.TargetName = const_cast<wchar_t*>(target.c_str());
      credential.CredentialBlob = w->key;
      credential.CredentialBlobSize = 32;
      credential.Persist = CRED_PERSIST_LOCAL_MACHINE;
      credential.UserName = const_cast<wchar_t*>(L"SuperAssistant protected key");
      w->success = CredWriteW(&credential, 0) != FALSE;
    }
  }
#ifdef SA_WINCRED_TEST
  else {
    unsigned char difference = 0;
    for (int i = 0; i < 32; ++i) difference |= existing[i] ^ w->key[i];
    if (missing || (found && difference != 0)) { w->success = true; w->cleaned = false; }
    else if (found) { w->cleaned = CredDeleteW(target.c_str(), CRED_TYPE_GENERIC, 0) != FALSE; w->success = w->cleaned; }
  }
#endif
  SecureZeroMemory(existing, sizeof(existing));
  ReleaseMutex(mutex);
  CloseHandle(mutex);
}
#else
static void Execute(napi_env, void*) {}
#endif

static void Complete(napi_env env, napi_status status, void* value) {
  Work* w = static_cast<Work*>(value);
  napi_value output{};
  if (status != napi_ok || !w->success) {
    napi_value message{}, error{};
    napi_create_string_utf8(env, "Windows credential operation failed", NAPI_AUTO_LENGTH, &message);
    napi_create_error(env, nullptr, message, &error);
    napi_reject_deferred(env, w->promise, error);
  } else {
    if (w->operation == Operation::Cleanup) napi_get_boolean(env, w->cleaned, &output);
    else if (w->missing) napi_get_null(env, &output);
    else napi_create_buffer_copy(env, sizeof(w->key), w->key, nullptr, &output);
    napi_resolve_deferred(env, w->promise, output);
  }
  Erase(w->key, sizeof(w->key));
  napi_delete_async_work(env, w->work);
  delete w;
}

static napi_value Start(napi_env env, napi_callback_info info, Operation operation) {
  size_t argc = 2;
  napi_value args[2]{};
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  size_t length = 0;
  char reference[70]{};
  if (argc != (operation == Operation::Cleanup ? 2u : 1u)
      || napi_get_value_string_utf8(env, args[0], nullptr, 0, &length) != napi_ok || length != 69
      || napi_get_value_string_utf8(env, args[0], reference, sizeof(reference), &length) != napi_ok
      || length != 69 || std::memcmp(reference, "pkey-", 5) != 0) {
    napi_throw_error(env, nullptr, "Windows credential operation failed");
    return nullptr;
  }
  for (size_t i = 5; i < length; ++i) {
    if (!((reference[i] >= '0' && reference[i] <= '9') || (reference[i] >= 'a' && reference[i] <= 'f'))) {
      napi_throw_error(env, nullptr, "Windows credential operation failed");
      return nullptr;
    }
  }
  Work* w = new Work();
  w->env = env;
  w->operation = operation;
  w->reference.assign(reference, length);
  if (operation == Operation::Cleanup) {
    bool isBuffer = false; void* data = nullptr; size_t size = 0;
    if (napi_is_buffer(env, args[1], &isBuffer) != napi_ok || !isBuffer
        || napi_get_buffer_info(env, args[1], &data, &size) != napi_ok || size != 32) {
      delete w;
      napi_throw_error(env, nullptr, "Windows credential operation failed");
      return nullptr;
    }
    std::memcpy(w->key, data, 32);
  }
  napi_value promise{}, name{};
  if (napi_create_promise(env, &w->promise, &promise) != napi_ok
      || napi_create_string_utf8(env, "protected credential", NAPI_AUTO_LENGTH, &name) != napi_ok
      || napi_create_async_work(env, nullptr, name, Execute, Complete, w, &w->work) != napi_ok
      || napi_queue_async_work(env, w->work) != napi_ok) {
    if (w->work) napi_delete_async_work(env, w->work);
    Erase(w->key, sizeof(w->key));
    delete w;
    napi_throw_error(env, nullptr, "Windows credential operation failed");
    return nullptr;
  }
  return promise;
}
static napi_value Create(napi_env env, napi_callback_info info) { return Start(env, info, Operation::Create); }
static napi_value Read(napi_env env, napi_callback_info info) { return Start(env, info, Operation::Read); }
#ifdef SA_WINCRED_TEST
static napi_value Cleanup(napi_env env, napi_callback_info info) { return Start(env, info, Operation::Cleanup); }
#endif
static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor properties[] = {
    { "create", nullptr, Create, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "read", nullptr, Read, nullptr, nullptr, nullptr, napi_default, nullptr },
#ifdef SA_WINCRED_TEST
    { "cleanup", nullptr, Cleanup, nullptr, nullptr, nullptr, napi_default, nullptr },
#endif
  };
  napi_define_properties(env, exports, sizeof(properties) / sizeof(properties[0]), properties);
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
