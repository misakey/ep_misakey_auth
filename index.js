var ERR = require('async-stacktrace');

var eejs = require('ep_etherpad-lite/node/eejs');
var settings = require('ep_etherpad-lite/node/utils/Settings');
var authorManager = require('ep_etherpad-lite/node/db/AuthorManager');
var passport = require('passport');
var OpenIDConnectStrategy = require('passport-openidconnect').Strategy;

// Override the strategy to make prompt a param from auth and not from whole client
OpenIDConnectStrategy.prototype.authorizationParams = function(options) {
  return (options.prompt ? { prompt: options.prompt } : {});
}

settings.users.oidc = settings.ep_misakey_auth.client;

// Settings variables check
if(!settings.users || !settings.users.oidc) {
  throw new Error('ep_misakey_auth plugin requires users and oidc settings!');
} else {
    if (!settings.users.oidc.clientID) throw new Error('ep_misakey_auth plugin requires a clientID setting!');
    if (!settings.users.oidc.clientSecret) throw new Error('ep_misakey_auth plugin requires a clientSecret setting!');
    if (!settings.users.oidc.callbackURL) throw new Error('ep_misakey_auth plugin requires a callbackURL setting!');
    if (!settings.users.oidc.scope) throw new Error('ep_misakey_auth plugin requires a scope setting!');
}

// Settings Variables
var issuer = settings.users.oidc.issuer || "https://auth.misakey.com/_/";
var authorizationURL = settings.users.oidc.authorizationURL || "https://auth.misakey.com/_/oauth2/auth";
var tokenURL = settings.users.oidc.tokenURL || "https://auth.misakey.com/_/oauth2/token";
var clientID = settings.users.oidc.clientID;
var clientSecret = settings.users.oidc.clientSecret;
var userinfoURL = settings.users.oidc.userinfoURL || "https://auth.misakey.com/_/userinfo";
var usernameKey = settings.users.oidc.usernameKey || "sub";
var idKey = settings.users.oidc.useridKey || "sub";
var passReqToCallback = settings.users.oidc.passReqToCallback ? true : false;
var skipUserProfile = settings.users.oidc.skipUserProfile ? true : false;
var callbackURL = settings.users.oidc.callbackURL;
var responseType = settings.users.oidc.responseType || "id_token";
var scope = settings.users.oidc.scope || ["user"];

var adminsSub = settings.ep_misakey_auth.adminsSub || [];
var usersSub = settings.ep_misakey_auth.usersSub || false;


exports.expressConfigure = function(hook_name, context) {
  console.debug('ep_misakey_auth.expressConfigure');
  passport.use('oidc', new OpenIDConnectStrategy({
          issuer: issuer,
          passReqToCallback: passReqToCallback,
          skipUserProfile: skipUserProfile,
          authorizationURL: authorizationURL,
          tokenURL: tokenURL,
          clientID: clientID,
          userInfoURL: userinfoURL,
          clientSecret: clientSecret,
          callbackURL: callbackURL,
          responseType: responseType,
          scope: scope
  }, function(iss, sub, profile, accessToken, refreshToken, cb) {
    var data = {
      token: {
        type: 'bearer',
        accessToken: accessToken,
        refreshToken: refreshToken
      },
      sub,
      authorId: sub,
    }
    authorManager.createAuthorIfNotExistsFor(data[idKey], data[usernameKey]).then(function(authorId) {
      data.authorId = authorId;
      return cb(null, data);
    }).catch(cb);
  }));

  //if this fails and you get an exception for missing passport session, add the passport initialize and session directly in the etherpad server configuration. 
  //(/node_modules/ep_etherpad-lite/node/hooks/express.js, before server.listen)
  var app = context.app;
  app.use(passport.initialize());
  app.use(passport.session());
}

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});


function setUsername(token, username) {
  console.debug('ep_misakey_auth.setUsername: getting authorid for token %s', token);
  authorManager.getAuthor4Token(token, function(err, author) {
    if (ERR(err)) {
      console.debug('ep_misakey_auth.setUsername: could not get authorid for token %s', token);
    } else {
      console.debug('ep_misakey_auth.setUsername: have authorid %s, setting username to "%s"', author, username);
      authorManager.setAuthorName(author, username);
    }
  });
  return;
}

exports.expressCreateServer = function (hook_name, context) {
  console.debug('ep_misakey_auth.expressCreateServer');
  var app = context.app;

  app.get('/auth/logout', function(req, res){
      req.session.destroy(function(e){
        req.logout();
        res.redirect('/auth/logout-success');
      });
  });

  app.get('/auth/logout-success', function(req, res){
    var render_args = {
      style: eejs.require('ep_misakey_auth/templates/style.ejs', {}),
    };

    res.send(eejs.require('ep_misakey_auth/templates/loggedout.ejs', render_args));
//    res.send("<em>Create a real page: loggedout successfull, click to reconnect prompt=login</em>")
  });

  app.get('/auth/login', function(req, res, next) {
    req.logout();
    req.session.userFound = false;
    req.session.user = null;
    return passport.authenticate('oidc', { prompt: 'login' })(req, res, next);
  })

  app.get('/auth/callback', passport.authenticate('oidc', { successRedirect: '/', failureRedirect: '/auth/failure' }));

  app.get('/auth/failure', function(req, res) {
    res.send("<em>Authentication Failed (unknown error)</em>")
  });

  app.get('/auth/unauthorized', function(req, res) {
    var render_args = {
      style: eejs.require('ep_misakey_auth/templates/style.ejs', {}),
      sub: req.session.user.sub,
    };

    res.send(eejs.require('ep_misakey_auth/templates/unauthorized.ejs', render_args));

    // res.send("<em>Create a real page: Not authorized. display the sub Create a button to login to another profile / account</em>");
  });
}

exports.authenticate = function(hook_name, context, cb) {
  console.debug('ep_misakey_auth.authenticate from ->', context.req.url);

  if (context.req.session.passport) {
    // If a session is already present, do not restart a new auth session, just persist the user in session and redirect connected user.
    context.req.session.userFound = true;
    context.req.session.user = context.req.session.passport.user;
    if (!context.req.session.afterAuthUrl || context.req.session.afterAuthUrl.startsWith('/auth')) {
      context.req.session.afterAuthUrl = '/';
    }
    var redirectTo = context.req.session.afterAuthUrl;
    context.res.redirect(redirectTo);
  } else if (!context.req.url.startsWith('/auth')) {
    context.req.session.afterAuthUrl = context.req.url;
    passport.authenticate('oidc')(context.req, context.res, context.next); 
  } else {
    cb([true])
  }
}

exports.authorize = function(hook_name, context, cb) {
    // allow healthcheck without authentication
    if (context.resource.match(/^\/(healthcheck)/)) return cb([true]);

    if (context.resource.indexOf('/auth') === 0) return cb([true]);

    // everything else at least needs a login session
    if (!context.req.session.user) return cb([false]);
    var userSub = context.req.session.user.sub;

    if (usersSub && [...adminsSub, ...usersSub].indexOf(userSub) < 0) {
      context.res.redirect('/auth/unauthorized');
      return;
    }

    // protect the admin routes
    if (context.resource.indexOf('/admin') === 0 && adminsSub.indexOf(userSub) < 0) return cb([false]);

    cb([true]);
}

exports.handleMessage = function(hook_name, context, cb) {
  console.debug("ep_misakey_auth.handleMessage");
  if ( context.message.type == "CLIENT_READY" ) {
    if (!context.message.token) {
      console.debug('ep_misakey_auth.handleMessage: intercepted CLIENT_READY message has no token!');
    } else {
      var client_id = context.client.id;
            console.log(JSON.stringify(context.client.client.request.session.user));
      if ('user' in context.client.client.request.session) {
        var displayName = context.client.client.request.session.user['name'];
        console.debug('ep:oidc.handleMessage: intercepted CLIENT_READY message for client_id = %s, setting username for token %s to %s', client_id, context.message.token, displayName);
        setUsername(context.message.token, displayName);
      }
      else {
        console.debug('ep_misakey_auth.handleMessage: intercepted CLIENT_READY but user does have displayName !');
      }
    }
  } else if ( context.message.type == "COLLABROOM" && context.message.data.type == "USERINFO_UPDATE" ) {
    console.debug('ep_misakey_auth.handleMessage: intercepted USERINFO_UPDATE and dropping it!');
    return cb([null]);
  }
  return cb([context.message]);
};
