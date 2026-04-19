/**
 * EventBus Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetBrowserMock } from './browser-mock.js';
import { loadAll } from './load-engine.js';

let EX;
beforeEach(() => { resetBrowserMock(); EX = loadAll().EX; });

describe('EventBus', () => {
  it('on() registers a handler and emit() calls it', () => {
    let called = false;
    EX.EventBus.on('test', () => { called = true; });
    EX.EventBus.emit('test');
    expect(called).toBe(true);
  });

  it('emit() passes data to the handler', () => {
    let received = null;
    EX.EventBus.on('test', d => { received = d; });
    EX.EventBus.emit('test', { foo: 42 });
    expect(received).toEqual({ foo: 42 });
  });

  it('multiple handlers fire in order', () => {
    const order = [];
    EX.EventBus.on('multi', () => order.push(1));
    EX.EventBus.on('multi', () => order.push(2));
    EX.EventBus.emit('multi');
    expect(order).toEqual([1, 2]);
  });

  it('off() removes a specific handler', () => {
    let count = 0;
    const fn = () => { count++; };
    EX.EventBus.on('test', fn);
    EX.EventBus.emit('test');
    expect(count).toBe(1);
    EX.EventBus.off('test', fn);
    EX.EventBus.emit('test');
    expect(count).toBe(1); // not called again
  });

  it('emit() with no handlers is a no-op', () => {
    expect(() => EX.EventBus.emit('nonexistent')).not.toThrow();
  });

  it('handler errors are caught and do not break other handlers', () => {
    let secondCalled = false;
    EX.EventBus.on('err', () => { throw new Error('boom'); });
    EX.EventBus.on('err', () => { secondCalled = true; });
    EX.EventBus.emit('err');
    expect(secondCalled).toBe(true);
  });
});
