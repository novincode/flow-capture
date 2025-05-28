// Utilities for messaging between extension contexts

// Common message types
export enum MessageType {
  START_RECORDING = 'START_RECORDING',
  STOP_RECORDING = 'STOP_RECORDING',
  RECORDING_COMPLETE = 'RECORDING_COMPLETE',
  RECORDING_ERROR = 'RECORDING_ERROR'
}

export interface ExtensionMessage {
  type: MessageType;
  data?: any;
}

// Send a message to the content script
export function sendMessageToContentScript(
  tabId: number, 
  message: ExtensionMessage
): Promise<any> {
  return chrome.tabs.sendMessage(tabId, message);
}

// Send a message to the background script
export function sendMessageToBackground(message: ExtensionMessage): Promise<any> {
  return chrome.runtime.sendMessage(message);
}

// Listen for messages from any context
export function addMessageListener(
  callback: (message: ExtensionMessage, sender: any, sendResponse: Function) => void
): void {
  chrome.runtime.onMessage.addListener(callback);
}
