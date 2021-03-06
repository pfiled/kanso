/*global unescape: false */

/**
 * Flash messages only persist for the next request or the next template render!
 * That means 2 redirects without explicitly currying the flash messages will
 * cause the messages to be lost.
 */

var utils = require('./utils'),
    cookies = require('./cookies'),
    _ = require('./underscore');


exports.readRequestCookie = function (req) {
    var cookie = req.cookie._kanso_flash;
    var messages = cookie ? JSON.parse(unescape(cookie)): [];
    return _.map(messages, function (val) {
        val.incoming = true;
        val.outgoing = false;
        return val;
    });
};

exports.readBrowserCookie = function () {
    var cookie = cookies.readBrowserCookie('_kanso_flash');
    var messages = cookie ? JSON.parse(unescape(cookie)): [];
    return _.map(messages, function (val) {
        val.incoming = true;
        val.outgoing = false;
        return val;
    });
};

exports.updateRequest = function (req) {
    var messages = exports.readRequestCookie(req);
    req.flash_messages = _.map(messages, function (val) {
        val.incoming = true;
        val.outgoing = false;
        return val;
    });
    return req;
};

exports.getMessages = function (req) {
    if (utils.isBrowser) {
        // also remove any messages from this request already set in the cookie
        var cookie_messages = exports.readBrowserCookie();
        var bmessages = _.filter(cookie_messages, function (val) {
            return val.req !== req.uuid;
        });
        if (bmessages.length !== cookie_messages.length) {
            //console.log('removing cookies for this request:');
            //console.log(bmessages);
            exports.setBrowserCookie(req, bmessages);
        }
    }

    var messages = _.map(req.flash_messages, function (val) {
        val.outgoing = false;
        return val;
    });
    req.flash_messages = messages;

    return _.map(messages, function (val) {
        return val.data;
    });
};

exports.getOutgoingMessages = function (req) {
    return _.filter(req.flash_messages, function (val) {
        return val.outgoing;
    });
};

exports.updateResponse = function (req, res) {
    var messages = _.map(exports.getOutgoingMessages(req), function (val) {
        delete val.outgoing;
        delete val.incoming;
        return val;
    });
    //console.log('flashmessages.updateResponse');
    //console.log(messages);
    if (req.response_received) {
        exports.setBrowserCookie(req, messages);
    }
    else {
        cookies.setResponseCookie(req, res, {
            name: '_kanso_flash',
            value: JSON.stringify(messages)
        });
    }
    return res;
};

exports.createMessage = function (req, msg) {
    return {
        req: req.uuid,
        data: msg
    };
};

exports.setBrowserCookie = function (req, messages) {
    //console.log('flashmessages.setBrowserCookie');
    //console.log(messages);
    cookies.setBrowserCookie(req, {
        name: '_kanso_flash',
        value: JSON.stringify(messages)
    });
};

// store new messages on the request until the response is sent later,
// since we don't know the response object until the list / show / update
// function has returned.

exports.addMessage = function (req, msg) {
    if (!req.flash_messages) {
        req.flash_messages = [];
    }
    var message = exports.createMessage(req, msg);
    if (req.response_received) {
        // the function has already returned, addMessage must have been called
        // in a callback for some client-side only function, set the cookie
        // directly
        var messages = exports.readBrowserCookie();

        messages.push(message);
        exports.setBrowserCookie(req, messages);
        req.flash_messages.push(message);
    }
    else {
        message.outgoing = true;
        req.flash_messages.push(message);
    }
};
