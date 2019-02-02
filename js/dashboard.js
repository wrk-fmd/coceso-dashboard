const serverState = {
  reachable: "reachable",
  failed: "failed",
  unknown: "unknown"
};

const tetraRadioState = {
  offline: "OFFLINE",
  online: "ONLINE",
  initializing: "INITIALIZING",
  unknown: "UNKNOWN"
};

ko.extenders.serverState = function (targetObservable, options) {
  var stateString = ko.pureComputed(function () {
    switch (this()) {
      case serverState.reachable:
        return "OK";
      case serverState.failed:
        return "FAILED";
      case serverState.unknown:
      default:
        return "UNKNOWN";
    }
  }, targetObservable);

  stateString.state = ko.pureComputed(function () {
    switch (this()) {
      case serverState.reachable:
        return "list-group-item-success";
      case serverState.failed:
        return "list-group-item-danger";
      case serverState.unknown:
      default:
        return "list-group-item-warning";
    }
  }, targetObservable);

  return stateString;
};

ko.extenders.tetraRadioState = function (targetObservable, options) {
  var stateString = ko.pureComputed(function () {
    switch (this()) {
      case tetraRadioState.online:
        return "Online";
      case tetraRadioState.offline:
        return "Offline";
      case tetraRadioState.initializing:
        return "Initializing";
      case tetraRadioState.unknown:
      default:
        return "UNKNOWN";
    }
  }, targetObservable);

  stateString.state = ko.pureComputed(function () {
    switch (this()) {
      case tetraRadioState.online:
        return "list-group-item-success";
      case tetraRadioState.offline:
        return "list-group-item-danger";
      case tetraRadioState.initializing:
      case tetraRadioState.unknown:
      default:
        return "list-group-item-warning";
    }
  }, targetObservable);

  return stateString;
};

ko.extenders.statisticNumberString = function (targetObservable, options) {
  var numberString = ko.pureComputed(function () {
    return $.isNumeric(this()) ? this() : "N/A"
  }, targetObservable);

  numberString.state = ko.pureComputed(function () {
    let cssState = "";
    if ($.isNumeric(this()) && options) {
      if (options.errorThreshold && this() >= options.errorThreshold) {
        cssState = "badge-danger";
      } else if (options.warnThreshold && this() >= options.warnThreshold) {
        cssState = "badge-warning";
      } else {
        cssState = "badge-success"
      }
    }

    return cssState;
  }, targetObservable);

  return numberString;
};

function smsStartTimer(smsViewModel) {
  setTimeout(function () {
    updateSmsGateway(smsViewModel)
  }, intervalConfiguration.smsGatewayInterval);
}

function updateSmsGateway(smsViewModel) {
  $.get({
    dataType: "json",
    url: endpointConfiguration.gsmEndpoint,
    success: function (responseBody) {
      smsViewModel.serverState(serverState.reachable);
      if (responseBody) {
        smsViewModel.queuedMessages(responseBody.queuedTextMessages);
        smsViewModel.inboxMessages(responseBody.gammuStatistics.inboxMessages);
        smsViewModel.outboxMessages(responseBody.gammuStatistics.outboxMessages);
        smsViewModel.errorMessages(responseBody.gammuStatistics.errorMessages);
        smsViewModel.sentMessages(responseBody.gammuStatistics.sentMessages);
      } else {
        smsViewModel.resetMessageCounts();
      }

      smsStartTimer(smsViewModel);
    }
  }).fail(function () {
    smsViewModel.serverState(serverState.failed);
    smsStartTimer(smsViewModel);
  });
}

function tetraStartTimer(tetraViewModel) {
  setTimeout(function () {
    updateTetraGateway(tetraViewModel)
  }, intervalConfiguration.tetraGatewayInterval);
}

function updateTetraGateway(tetraViewModel) {
  $.get({
    dataType: "json",
    url: endpointConfiguration.tetraStatusUrl,
    success: function (responseBody) {
      tetraViewModel.serverState(serverState.reachable);
      if (responseBody) {
        tetraViewModel.tetraRadioState(responseBody.connectionState);
        tetraViewModel.queuedMessages(responseBody.queuedMessages);
        tetraViewModel.sentMessages(responseBody.sentMessages);
        tetraViewModel.failedMessages(responseBody.failedMessages);
        tetraViewModel.waitingForAckMessages(responseBody.waitingForAckMessages);
        tetraViewModel.sendingMessages(responseBody.sendingMessages);
        tetraViewModel.inboxMessages(responseBody.inboxMessages);
      } else {
        smsViewModel.resetMessageCounts();
      }

      tetraStartTimer(tetraViewModel);
    }
  }).fail(function () {
    tetraViewModel.serverState(serverState.failed);
    tetraStartTimer(tetraViewModel);
  });

}

function backendStartTimer(backendViewModel) {
  setTimeout(function () {
    updateBackendStatistics(backendViewModel)
  }, intervalConfiguration.backendInterval);
}

function updateBackendStatistics(backendViewModel) {
  let sendTime = (new Date()).getTime();

  $.get({
    url: endpointConfiguration.backendUrl,
    success: function (responseBody) {
      backendViewModel.serverState(serverState.reachable);

      let receiveTime = (new Date()).getTime();
      let latencyInMilliseconds = receiveTime - sendTime;
      backendViewModel.latency(latencyInMilliseconds);

      backendStartTimer(backendViewModel);
    }
  }).fail(function () {
    backendViewModel.serverState(serverState.failed);
    backendViewModel.latency(null);
    backendStartTimer(backendViewModel);
  });

}

let SmsViewModel = function () {
  let self = this;

  this.serverState = ko.observable(serverState.unknown);

  this.queuedMessages = ko.observable(null);
  this.inboxMessages = ko.observable(null);
  this.outboxMessages = ko.observable(null);
  this.sentMessages = ko.observable(null);
  this.errorMessages = ko.observable(null);

  this.serverStateString = this.serverState.extend({serverState: true});
  this.queuedString = this.queuedMessages.extend({statisticNumberString: {warnThreshold: 10, errorThreshold: 20}});
  this.inboxString = this.inboxMessages.extend({statisticNumberString: {}});
  this.outboxString = this.outboxMessages.extend({statisticNumberString: {warnThreshold: 15, errorThreshold: 30}});
  this.sentString = this.sentMessages.extend({statisticNumberString: {}});
  this.errorString = this.errorMessages.extend({statisticNumberString: {errorThreshold: 1}});

  this.resetMessageCounts = function () {
    self.queuedMessages(null);
    self.inboxMessages(null);
    self.outboxMessages(null);
    self.sentMessages(null);
    self.errorMessages(null);
  };

  updateSmsGateway(self)
};

let TetraViewModel = function () {
  let self = this;

  this.serverState = ko.observable(serverState.unknown);
  this.tetraRadioState = ko.observable(tetraRadioState.unknown);

  this.queuedMessages = ko.observable(null);
  this.sentMessages = ko.observable(null);
  this.failedMessages = ko.observable(null);
  this.waitingForAckMessages = ko.observable(null);
  this.sendingMessages = ko.observable(null);
  this.inboxMessages = ko.observable(null);

  this.serverStateString = this.serverState.extend({serverState: true});
  this.tetraRadioStateString = this.tetraRadioState.extend({tetraRadioState: true});

  this.queuedString = this.queuedMessages.extend({statisticNumberString: {warnThreshold: 10, errorThreshold: 20}});
  this.sentString = this.sentMessages.extend({statisticNumberString: {}});
  this.failedString = this.failedMessages.extend({statisticNumberString: {warnThreshold: 1, errorThreshold: 5}});
  this.waitingForAckString = this.waitingForAckMessages.extend({statisticNumberString: {warnThreshold: 1}});
  this.sendingString = this.sendingMessages.extend({statisticNumberString: {warnThreshold: 1, errorThreshold: 2}});
  this.inboxString = this.inboxMessages.extend({statisticNumberString: {}});

  this.resetMessageCounts = function () {
    self.tetraRadioState(tetraRadioState.unknown);
    self.queuedMessages(null);
    self.sentMessages(null);
    self.failedMessages(null);
    self.waitingForAckMessages(null);
    self.sendingMessages(null);
    self.inboxMessages(null);
  };

  updateTetraGateway(self)
};

let BackendViewModel = function () {
  let self = this;

  this.serverState = ko.observable(serverState.unknown);
  this.latency = ko.observable(null);

  this.serverStateString = this.serverState.extend({serverState: true});
  this.latencyString = this.latency.extend({statisticNumberString: {warnThreshold: 100, errorThreshold: 300}});

  updateBackendStatistics(self)
};

let DashboardViewModel = function () {
  this.smsGateway = new SmsViewModel();
  this.tetraGateway = new TetraViewModel();
  this.backendStatistics = new BackendViewModel();
};

ko.applyBindings(new DashboardViewModel());