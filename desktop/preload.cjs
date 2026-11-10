const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('crowdkartDesktop', {
  platform: process.platform,
  // The page is served by the (embedded or remote) server itself, so API calls stay same-origin.
  serverUrl: '',
});
