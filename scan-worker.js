/* Background worker: finds and reads the answer sheet in camera frames. */
importScripts('omr.js');
self.onmessage = e => {
  let out;
  try { out = OMR.task(e.data); } catch (err) { out = { msg: { id: e.data.id, ok: false, code: 'error' } }; }
  self.postMessage(out.msg, out.transfer || []);
};
