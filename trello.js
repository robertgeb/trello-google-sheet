// Get your app key : https://trello.com/app-key
var trelloKey = "your_key";
// Google's OAuth 1.0 support was deprecated and since Trello only supports OAuth 1
// we will have to send the key and token in the REST calls
// Token is generated by authorizing the following url with your trello login : 
// https://trello.com/1/authorize?key={trelloKey}&name=GoogleSheets&expiration=never&response_type=token&scope=read,write
var trelloToken = "your_token";
var trelloAPIEndPoint = "https://api.trello.com/1";
var username = "your_username";
var mainSheetName = "Trello";
var insertCardStickers = false;
var addBoardSheets = true;
var delimiter = "|+|";

/**
 * Main function call, adds all boards accessible by user as sheets on the spreadsheet
 * 
 */
function getTrelloData() {
  resetMainSheet();
  getBoards(function (board) {
    getBoardLists(board, function (board, boardLists, boardSheet) {
      getCards(board, boardLists, boardSheet);
    });
  });
}

/**
 * Sets the addBoardSheets flag to false (only updates main sheet) and calls the getTrelloData function
 * 
 */
function updateMainSheet() {
  addBoardSheets = false;
  insertCardStickers = false;
  getTrelloData();
}

/**
 * Sets the addBoardSheets flag to true and calls the getTrelloData function
 * 
 */
function updateAllBoardSheets() {
  addBoardSheets = true;
  getTrelloData();
}

/**
 * Updates the current Board sheet. If main sheet is open give user message
 * 
 */
function updateCurrentBoard() {
  var activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (activeSheet.getName() === mainSheetName) {
    //show message
    SpreadsheetApp.getUi().alert("Select 'Update Main Sheet' option or activate correct board sheet");
    return;
  }
  // Get Data for specific board
  getBoards(function (board) {
    getBoardLists(board, function (board, boardLists, boardSheet) {
      getCards(board, boardLists, boardSheet);
    });
  }, activeSheet.getName());
}

/**
 * Deletes all board sheets and resets main sheet
 * 
 */
function resetAll() {
  resetMainSheet();
  var allSheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var sheetIdx = 0; sheetIdx < allSheets.length; sheetIdx++) {
    if (allSheets[sheetIdx].getName() !== mainSheetName) {
      SpreadsheetApp.getActiveSpreadsheet().deleteSheet(allSheets[sheetIdx]);
    }
  }
}

/**
 * Call the Trello API with specified api function, key and token
 * 
 * @param {string} url the api function to call
 * @returns {JSON}
 */
function trelloFetch(url) {
  var completeUrl = trelloAPIEndPoint + url + "?key=" + trelloKey + "&token=" + trelloToken;
  var jsonData = UrlFetchApp.fetch(completeUrl);
  return JSON.parse(jsonData.getContentText());
}

/**
 * Gets all the boards for sepcified username, pass the board id and name to the callback function
 * 
 * @param {function} callback
 * @param {String} boardName If defined only that board sheet will be added
 */
function getBoards(callback, boardName) {
  var paramUrl = "/members/" + username + "/boards/";
  var userBoardList = trelloFetch(paramUrl);
  var count = userBoardList.length;

  for (var i = 0; i < count - 1; i++) {
    if (!userBoardList[i].closed && (!boardName || boardName === userBoardList[i].name)) {
      callback(userBoardList[i]);
    }
  }
}

/**
 * Gets all the lists for a board and calls the card function for each list
 * 
 * @param {string} board
 * @param {function} callback
 */
function getBoardLists(board, callback) {
  var paramUrl = "/boards/" + board.id + '/lists';
  var boardLists = trelloFetch(paramUrl);
  var boardSheet;
  // boardSheet will be undefined if we do not need to create the board sheets
  if (addBoardSheets) {
    boardSheet = addBoardSheet(board, boardLists);
  }

  callback(board, boardLists, boardSheet);
}

/**
 * Adds and styles headers for a board sheet
 * 
 * @param {type} board
 * @param {type} boardLists
 * @returns {Sheet} boardSheet
 */
function addBoardSheet(board, boardLists) {
  var count = boardLists.length;
  var boardSheet = getNewSheet(board.name);
  var headerNames = [];
  var subHeaders = [];
  // Set sheet name and URL header values
  boardSheet.getRange(1, 1, 1, 1).setValues([[board.name]]);
  boardSheet.getRange(1, 3, 1, 1).setValues([[board.url]]);
  // Add column headers for all board lists
  for (var i = 0; i < count; i++) {
    headerNames[i * 2] = boardLists[i].name;
    headerNames[(i * 2) + 1] = "";
    boardSheet.setColumnWidth((i * 2) + 1, 150);
    boardSheet.setColumnWidth((i * 2) + 2, 150);
    subHeaders[i * 2] = "Card Name";
    subHeaders[(i * 2) + 1] = "Labels&Stickers";
  }
  boardSheet.getRange(2, 1, 1, count * 2).setValues([headerNames]);
  boardSheet.getRange(3, 1, 1, count * 2).setValues([subHeaders]);
  mergeCells(boardSheet, 2, 2, count * 2);
  // Style the List name header
  styleCells(boardSheet.getRange(1, 1, 1, 1), "black", "white", 12);
  styleCells(boardSheet.getRange(2, 1, 1, count * 2), "black", "#c9daf8", 14);
  styleCells(boardSheet.getRange(3, 1, 1, count * 2), "black", "#c9daf8", 11);

  return boardSheet;
}

/**
 * Gets the cards for a list and add them in the column under the list name on the board sheet
 * 
 * @param {Object} board
 * @param {Object[]} boardLists
 * @param {Sheet} boardSheet
 */
function getCards(board, boardLists, boardSheet) {
  for (var i = 0; i < boardLists.length; i++) {
    var paramUrl = "/lists/" + boardLists[i].id + '/cards';
    var cards = trelloFetch(paramUrl); // all cards from a given List
    addCardToSheets(board, cards, boardSheet, boardLists[i], i);
  }
}

/**
 * Adds the cards on the sheets
 * 
 * @param {Object} board
 * @param {Object} cards A list of the cards
 * @param {Sheet} boardSheet
 * @param {Object} boardList 
 * @param {numeric} listIndex index of current list used to get column index for stickers
 */
function addCardToSheets(board, cards, boardSheet, boardList, listIndex) {
  var mainSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(mainSheetName);
  for (var j = 0; j < cards.length; j++) {
    var card = cards[j];
    var cardStickerString = getCardStickers(insertCardStickers, card.id, boardSheet, 4 + j, 2 + (listIndex * 2));
    var cardLabels = getCardLabels(card);
    if (addBoardSheets) {
      boardSheet.getRange(4 + j, 1 + (listIndex * 2), 1, 1).setWrap(true).setValue(card.name);
      boardSheet.getRange(4 + j, 2 + (listIndex * 2), 1, 1).setWrap(true).setValue(cardLabels + cardStickerString);
    }
    // Add card entry in main sheet
    mainSheet.getRange(mainSheet.getLastRow() + 1, 1, 1, 8).setWrap(true).setValues([[board.name, boardList.name, card.name,
        cardLabels, cardStickerString, card.dateLastActivity, card.closed, card.shortUrl]]);
  }
}


/**
 * Builds a string with all the labels of a card and inserts the sticker image
 * 
 * @param {boolean} insertSticker Specify if the sticker image is inserted on the sheet
 * @param {string} cardId
 * @param {Sheet} sheet
 * @param {number} row
 * @param {number} col
 * @returns {string}
 */
function getCardStickers(insertSticker, cardId, sheet, row, col) {
  var paramUrl = "/cards/" + cardId + '/stickers';
  var stickers = trelloFetch(paramUrl);
  if (!stickers.length) {
    return "";
  }
  var stickerConcat = delimiter;
  for (var i = 0; i < stickers.length; i++) {
    var imageURL = stickers[i].imageUrl;
    if (imageURL) {
      stickerConcat += imageURL.substring(imageURL.lastIndexOf('/') + 1) + delimiter;
      if (insertSticker) {
        sheet.insertImage(imageURL, col, row);
      }
    }
  }
  return stickerConcat;
}

/**
 * Builds a string with all the labels of a card
 * 
 * @param {Object} card
 * @returns {string}
 */
function getCardLabels(card) {
  var labels = card.labels;
  if (!labels.length) {
    return "";
  }
  var labelsConcat = delimiter;
  for (var i = 0; i < labels.length; i++) {
    if (labels[i].name) {
      labelsConcat += labels[i].name + delimiter;
    }
  }
  return labelsConcat;
}

/**
 * Creates a new sheet with a specified name - delete any sheets with that name first
 * 
 * @param {string} sheetName
 * @returns {Sheet}
 */
function getNewSheet(sheetName) {
  var newSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  if (newSheet !== null) {
    SpreadsheetApp.getActiveSpreadsheet().deleteSheet(newSheet);
  }
  newSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet();
  newSheet.setName(sheetName);
  return newSheet;
}


/**
 * Sets up the columns for the main sheet and clears the old data
 */
function resetMainSheet() {
  var mainSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(mainSheetName);
  mainSheet.clearContents();
  mainSheet.setColumnWidth(1, 120);
  mainSheet.getRange(1, 1).setValue("Board");
  mainSheet.setColumnWidth(2, 180);
  mainSheet.getRange(1, 2).setValue("List");
  mainSheet.setColumnWidth(3, 300);
  mainSheet.getRange(1, 3).setValue("Card");
  mainSheet.setColumnWidth(4, 180);
  mainSheet.getRange(1, 4).setValue("Labels");
  mainSheet.setColumnWidth(5, 150);
  mainSheet.getRange(1, 5).setValue("Stickers");
  mainSheet.setColumnWidth(6, 150);
  mainSheet.getRange(1, 6).setValue("Last Activity");
  mainSheet.setColumnWidth(7, 80);
  mainSheet.getRange(1, 7).setValue("Closed");
  mainSheet.setColumnWidth(8, 150);
  mainSheet.getRange(1, 8).setValue("URL");
  mainSheet.setColumnWidth(9, 100);
  mainSheet.getRange(1, 9).setValue("");
  mainSheet.setColumnWidth(10, 100);
  mainSheet.getRange(1, 10).setValue("");
  styleCells(mainSheet.getRange(1, 1, 1, 10), "black", "#c9daf8", 14);
}

/**
 * Merge cells 
 * 
 * @param {Sheet} sheet
 * @param {number} row
 * @param {number} span
 * @param {number} columnCount
 */
function mergeCells(sheet, row, span, columnCount) {
  for (var col = 1; col <= columnCount; col += span) {
    sheet.getRange(row, col, 1, span).merge();
  }
}

/**
 * Set the style of a cell range
 * 
 * @param {Cell} cell
 * @param {color} foregrd
 * @param {color} backgrd
 * @param {number} fontSize
 */
function styleCells(cell, foregrd, backgrd, fontSize) {
  cell.setFontColor(foregrd);                     // to set font and
  cell.setBackground(backgrd);                    // background colours.
  cell.setFontSize(fontSize);
}

/**
 * Adds a custom menu to the active spreadsheet
 */
function onOpen() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var entries = [{
      name: "Update Main Sheet",
      functionName: "updateMainSheet"
    },
    {
      name: "Update All Board Sheets",
      functionName: "updateAllBoardSheets"
    },
    {
      name: "Update Current Board Sheet",
      functionName: "updateCurrentBoard"
    },
    {
      name: "Clear all",
      functionName: "resetAll"
    }];
  spreadsheet.addMenu("Trello", entries);
}