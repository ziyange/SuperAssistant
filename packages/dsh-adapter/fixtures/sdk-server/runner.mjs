/* global process */
import { Context } from '@deepseek-ai/cordis';
import { apply } from '@deepseek-ai/dsh-sdk-jsonrpc-server';

const ctx = new Context();
ctx.provide('agents', {});
ctx.provide('llm', { listProviders: () => [{ id: 'fixture-provider' }] });
apply(ctx, { input: process.stdin, output: process.stdout, exit: code => { process.exitCode = code; } });
