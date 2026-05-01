const test = require('node:test');
const assert = require('node:assert');
const proxyquire = require('proxyquire');

// Mock Electron Notification
class MockNotification {
  static supported = true;
  static isSupported() { return this.supported; }
  constructor(options) {
    this.options = options;
    this.shown = false;
    this.events = {};
  }
  on(event, cb) { this.events[event] = cb; }
  show() { this.shown = true; }
}

// Mock UIService
const mockUiService = {
  mainWindow: {
    webContents: {
      send: (channel, data) => {
        mockUiService.lastIpc = { channel, data };
      }
    },
    isMinimized: () => false,
    restore: () => {},
    show: () => {},
    focus: () => {}
  },
  lastIpc: null
};

const notifier = proxyquire('../src/main/services/notificationService', {
  'electron': { Notification: MockNotification },
  './uiService': mockUiService
});

test('NotificationService - notify', (_t) => {
  mockUiService.lastIpc = null;
  notifier.notify({ title: 'Test', body: 'Message', type: 'info' });
  
  assert.strictEqual(mockUiService.lastIpc.channel, 'notification-received');
  assert.strictEqual(mockUiService.lastIpc.data.title, 'Test');
  assert.strictEqual(mockUiService.lastIpc.data.body, 'Message');
});

test('NotificationService - notifyCriticalAction', (_t) => {
  mockUiService.lastIpc = null;
  notifier.notifyCriticalAction({ nome_pessoa: 'John Doe', campo: 'email' });
  
  assert.strictEqual(mockUiService.lastIpc.data.type, 'warning');
  assert.ok(mockUiService.lastIpc.data.body.includes('John Doe'));
  assert.ok(mockUiService.lastIpc.data.body.includes('email'));
});

test('NotificationService - notifyExecutionError', (_t) => {
  mockUiService.lastIpc = null;
  notifier.notifyExecutionError({ nome_pessoa: 'Jane Doe' }, 'Server error');
  
  assert.strictEqual(mockUiService.lastIpc.data.type, 'error');
  assert.ok(mockUiService.lastIpc.data.body.includes('Jane Doe'));
  assert.ok(mockUiService.lastIpc.data.body.includes('Server error'));
});
