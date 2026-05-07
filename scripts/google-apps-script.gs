const SHEET_ID = '1hIwGLn6oTixX4GUMA-nrTO7rZ7kuK-Ze08EzMJFufkY';
const SHEET_NAME = 'Sheet1';

function doOptions() {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');

    if (!data.name || !data.email || !data.repName) {
      return jsonResponse({ success: false, error: 'Missing required fields.' });
    }

    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME) || SpreadsheetApp.openById(SHEET_ID).getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Submitted At',
        'Name',
        'Email',
        'ZIP',
        'Representative',
        'Title',
        'Party',
        'Contact URL'
      ]);
    }

    sheet.appendRow([
      new Date(),
      data.name,
      data.email,
      data.zip || '',
      data.repName || '',
      data.repTitle || '',
      data.repParty || '',
      data.repLink || ''
    ]);

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
