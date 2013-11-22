function registerPeriodicalLumosityStatusAlarm() {
  chrome.alarms.create('recheck-lumosity', { periodInMinutes: 0.1 });
}

function registerLumosityStatusAlarmHandler() {
  chrome.alarms.onAlarm.addListener(function(alarm){
    if (alarm.name == 'recheck-lumosity') {
      updateTodaysLumosityTrainingStatus();
    }
  });
}

function loginRequired(doc) {
  return doc.getElementById('user_password')
}

function updateLoginRequiredStatus() {
  chrome.browserAction.setTitle({ title: 'Login to Lumosity is required' });
  chrome.browserAction.setIcon({ path: 'icons/19/brain-gray-19.png' });
}

function updateNetworkConnectionProblem() {
  chrome.browserAction.setTitle({ title: 'Seems that Lumosity is currently unavailable. please check you network connection' });
  chrome.browserAction.setIcon({ path: 'icons/19/brain-gray-19.png' });
}

function navigateToCurrentLumosityTrainingPage(callback) {
  var currentTrainingUrl = "http://www.lumosity.com/app/v4/current_training_session";

  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (this.readyState != 4) {
      return;
    } 

    if (this.response) {
      var doc = new DOMParser().parseFromString(this.response, "text/html");
      callback(doc);
    }
  };

  xhr.onerror = function(e) {
    updateNetworkConnectionProblem();
    console.log("error occured for GET request to: " + currentTrainingUrl);
  };

  xhr.open("GET", currentTrainingUrl, true);
  xhr.send();
}

function fetchTodaysGameList(doc, callback) {
  if (!doc) {
    updateNetworkConnectionProblem();
    return;
  }
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (this.readyState != 4) {
      return;
    }
    callback(this.response);
  };

  var trainingSessionDom = doc.getElementById('training-session');
  if (trainingSessionDom) {
    var trainingSessionUrl = trainingSessionDom.getAttribute('data-training-session-init-url');
    if (trainingSessionUrl) {
      xhr.open("GET", trainingSessionUrl, true);
      xhr.send();
    }
    else {
      updateNetworkConnectionProblem();
    }
  }
  else {
    updateNetworkConnectionProblem();
  }
}

function scanTodaysSession(todaysTrainingDom) {
  todaysTrainingJson = JSON.parse(todaysTrainingDom);
  if (userCompletedTodaysTrainingSession(todaysTrainingJson)) {
    return {
      completed: true
    };
  }
  return getGamesCompletedStatus(todaysTrainingJson);
}

function getGamesCompletedStatus(todaysTrainingJson) {
  var gameListHtmlString = todaysTrainingJson['#game-list'];
  var doc = new DOMParser().parseFromString(gameListHtmlString, "text/html");
  var gamesListDom = doc.getElementById('games');
  var gamesItems = gamesListDom.getElementsByTagName('li');
  var totalNumberOfGames = gamesItems.length;
  var gamesCompleted = 0;
  for (var i = 0, length = totalNumberOfGames; i < length; i++) {
    var gameItemDom = gamesItems[i];
    var spanDom = gameItemDom.getElementsByTagName('span'); 
    var gameStatus = spanDom[0].className;
    if (gameStatus == 'completed') {
      gamesCompleted++;
    }
  }

  return {
    gamesCompleted: gamesCompleted,
    totalNumberOfGames: totalNumberOfGames
  };
}

function userCompletedTodaysTrainingSession(todaysTrainingJson) {
  var todaysTrainingHtmlString = todaysTrainingJson['#training-session'];
  var todaysTrainingDom = new DOMParser().parseFromString(todaysTrainingHtmlString, "text/html");
  var containerDom = todaysTrainingDom.getElementById('training-summary-container');
  if (!containerDom) {
    return false;
  }

  var h3Dom = containerDom.getElementsByTagName('h3');
  if (!h3Dom || h3Dom.length <= 0) {
    return false;
  }

  var h3Text = h3Dom[0].innerText;
  return h3Text == "Great! You have completed today's training session.";
}

function updateTodaysLumosityTrainingStatus() {
  navigateToCurrentLumosityTrainingPage(function(doc) {
    if (loginRequired(doc)) {
      updateLoginRequiredStatus();
    }
    else {
      fetchTodaysGameList(doc, function(todaysTrainingDom){
        var todaysSessionStatus = scanTodaysSession(todaysTrainingDom);
        updateLumosityReminderIcon(todaysSessionStatus);
      });
    }
  });
}

function updateLumosityReminderIcon(todaysSessionStatus) {
  if (todaysSessionStatus.completed || todaysSessionStatus.gamesCompleted >= todaysSessionStatus.totalNumberOfGames) {
    chrome.browserAction.setTitle({ title: "You have completed Lumosity Today's Training Session!! :)" });
    chrome.browserAction.setIcon({ path: 'icons/19/brain-green-19.png' });
  }
  else if (todaysSessionStatus.gamesCompleted <= 0) {
    chrome.browserAction.setTitle({ title: "You haven't done Today's Lumosity Training yet :("});
    chrome.browserAction.setIcon({ path: 'icons/19/brain-red-19.png' });
  }
  else {
    chrome.browserAction.setTitle({ title: "You played today " + todaysSessionStatus.gamesCompleted + " out of " + todaysSessionStatus.totalNumberOfGames + ' games' });
    chrome.browserAction.setIcon({ path: 'icons/19/brain-yellow-19.png' });
  }
}

chrome.runtime.onInstalled.addListener(function(details){
  console.log('lumosity_reminder was installed');
  chrome.browserAction.onClicked.addListener(function() {
    chrome.tabs.create({ url: 'http://www.lumosity.com', active: true });
  });

  updateTodaysLumosityTrainingStatus();
  registerPeriodicalLumosityStatusAlarm();
  registerLumosityStatusAlarmHandler();
});