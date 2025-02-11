var express  = require('express')
  , session  = require('express-session')
  , passport = require('passport')
  , DiscordStrategy = require('passport-discord').Strategy
  , app      = express();
const crypto = require("crypto");
require("dotenv").config();
var cookieParser = require('cookie-parser')
const csrf = require("csurf")
const MongoDBStore = require("connect-mongodb-session")(session);
var store = new MongoDBStore({
	uri: process.env.MONGODB_HOST,
	collection: 'sessions',
	clear_interval: 3600
});
const { Webhook } = require('discord-webhook-node');
const adminHook = new Webhook(process.env.ADMIN_DISCORD_WEBHOOK);
const hook = new Webhook(process.env.DISCORD_WEBHOOK);
const rateLimit = require("express-rate-limit");
const fileUpload = require("express-fileupload")
const webp = require('webp-converter');
webp.grant_permission();
var GitHubStrategy = require('passport-github').Strategy;
var GoogleStrategy = require('passport-google-oauth20').Strategy;
function nocache(module) {require("fs").watchFile(require("path").resolve(module), () => {delete require.cache[require.resolve(module)]})}
nocache("./public/vukkies.json")
const vukkyJson = require("./public/vukkies.json")
var db = require('./db')
var fetch = require("node-fetch")
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

var scopes = ['identify', 'email'];
var prompt = 'consent'
app.set("view egine", "ejs")
passport.use(new DiscordStrategy({
	clientID: process.env.CLIENT_ID,
	clientSecret: process.env.CLIENT_SECRET,
	callbackURL: 'https://vukkybox.com/callbackdiscord',
	scope: scopes,
	prompt: prompt
}, function(accessToken, refreshToken, profile, done) {
  db.findOrCreate(profile.provider, profile, function(user) {
		done(null, user)
	  })
  
}));
passport.use(new GitHubStrategy({
	clientID: process.env.GITHUB_CLIENT_ID,
	clientSecret: process.env.GITHUB_CLIENT_SECRET,
	callbackURL: "https://vukkybox.com/callbackgithub",
	scope: ["user:email"]
  },
  function(accessToken, refreshToken, profile, cb) {
	fetch("https://api.github.com/user/emails", {
						headers: {
			  Accept: "application/json",
							Authorization: `token ${accessToken}`,
						},
		}).then(res => res.json()).then(res => {
	  let filtered = res.reduce((a, o) => (o.primary && a.push(o.email), a), [])      
	  profile.email = filtered[0]
	}).then (h => {
	  db.findOrCreate(profile.provider, profile, function(user) {
		cb(null, user)
	  })
	})
	
  }
));
passport.use(new GoogleStrategy({
	clientID: process.env.GOOGLE_CLIENT_ID,
	clientSecret: process.env.GOOGLE_CLIENT_SECRET,
	callbackURL: "https://vukkybox.com/callbackgoogle",
	scope: ["profile", "email"]
  },
  function(token, tokenSecret, profile, cb) {
	
	db.findOrCreate(profile.provider, profile, function(user) {
	  cb(null, user)
	})
  }
));
app.use(session({
	secret: process.env.SESSION_SECRET,
	resave: true,
	saveUninitialized: true,
	store: store
}));
app.use(passport.initialize());
app.use(passport.session());
app.use("/resources", express.static('public/resources'))
app.use(express.urlencoded({extended:true}));
app.use(express.json())
app.use(fileUpload())
app.use(cookieParser())
app.use(csrf({cookie: true, sessionKey: process.env.SESSION_SECRET}))
app.use(function (err, req, res, next) {
	if (err.code !== 'EBADCSRFTOKEN') return next(err)
	if(req.url != "/leaderboard") res.send("Couldn't verify Cross Site Request Forgery prevention")
	if(req.url == "/leaderboard") return next()
})
app.set('trust proxy', 1);

function errorHandler (err, req, res, next) {
	res.status(500).send(`<h1>The Vukkies are on fire!<h1>Please send a screenshot of this page to Vukkybox Support, including the error below in its entirety.<br><pre>${err.stack}</pre>`)
}

db.ethermineRVN() //worker ids got shortened to 20 characters only for some reason.. pissy!!
db.ethermineETH() 

function popupMid(req, res, next) {
	if (/MSIE|Trident/.test(req.headers['user-agent'])) return res.render(`${__dirname}/public/error.ejs`, { stacktrace: null, friendlyError: "Your browser is no longer supported by Vukkybox. Please <a href='https://browser-update.org/update-browser.html'>update your browser</a>." });
	if (req.headers['user-agent'].indexOf('Safari') != -1 && req.headers['user-agent'].indexOf('CriOS') == -1 && req.headers['user-agent'].indexOf('Macintosh') == -1 && req.headers['user-agent'].indexOf('OPR') == -1 && req.headers['user-agent'].indexOf('Edge') == -1 && req.headers['user-agent'].indexOf('Chrome') == -1) return res.render(`${__dirname}/public/error.ejs`, { stacktrace: null, friendlyError: "Sorry, but Safari for iPhones and iPads is not currently supported by Vukkybox. Please use a different browser, like <a href='https://apps.apple.com/us/app/google-chrome/id535886823'>Google Chrome</a>." });
	if (!req.isAuthenticated()) {
		console.log("not authenticated, skipping popup")
		return next()
	}
	if (req.user._id) {
		db.checkPopup(req.user._id, function (accepted) {
			if (accepted == 500) return res.send("500: Internal Server Error");
			if (!accepted) {
				res.redirect("/popup")
			} else {
				return next()
			}
		})
	} else {
		db.checkPopup(req.user[0]._id, function (accepted) {
			if (accepted == 500) return res.send("500: Internal Server Error");
			if (!accepted) {
				res.redirect("/popup")
			} else {
				return next()
			}
		})
	}
}

const grl = rateLimit({
	windowMs: 1000,
	max: 3,
	handler: function(req, res) {
		res.status(429).send("Hang on, you're going too fast for us to violently stuff Vukkies in boxes!<br>Please give us a second or five...<script>setTimeout(function() { window.location.reload() },2500)</script>")
	},
	keyGenerator: function (req /*, res*/) {
		return req.headers["cf-connecting-ip"];
	}
});

app.get('/login', grl, function(req, res) {
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	res.render(__dirname + '/public/login.ejs', {user: user, gravatarHash: user ? crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex") : null, redirect: req.session.redirectTo != undefined && req.session.redirectTo.length > 1 ? true : false});
});

app.get("/profile", grl, checkAuth, popupMid, function (req, res) {
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	res.render(__dirname + '/public/profile.ejs', {user: user, gravatarHash: user ? crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex") : null});
});

app.get("/editProfile", grl, checkAuth, popupMid, function (req, res) { 
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	res.render(__dirname + '/public/editProfile.ejs', {user: user, gravatarHash: user ? crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex") : null, csrfToken: req.csrfToken()});
})

app.post("/editProfile", grl ,checkAuth, function(req, res) {
	if(req.body.username != "") {
	  db.changeUsername(req.user, req.body.username)
	  req.session.passport.user.username = req.body.username
	}
	res.redirect("/profile")
})

function getKeyByValue(object, value) {
	return Object.keys(object).find(key => object[key] === value);
} // Why is this here?

const boxLimiter = rateLimit({
	windowMs: 1000,
	max: 2,
	keyGenerator: function (req /*, res*/) {
		return req.headers["cf-connecting-ip"];
	},
	handler: function(req, res) {
		if(req.rateLimit.current > 10) {
			adminHook.send(`<:woaha:904051837605408788> Warning! Sussy burgers are coming at rapid rates from the user with the ID of: ${req.user._id ? req.user._id.toString() : req.user[0]._id.toString()}`)
			res.status(429).send("Hang on, you're going too fast for us to violently stuff Vukkies in boxes! Here's something funny...<br><img src='https://i.imgur.com/twm4zX8.png'><br>This incident has been reported<script>setTimeout(function() { window.location.reload() },5000)</script>")
		} else {
			res.status(429).send("Hang on, you're going too fast for us to violently stuff Vukkies in boxes!<br>Please give us a second or five...<script>setTimeout(function() { window.location.reload() },2500)</script>")
		}
	}
});
app.get('/buyBox/:data', boxLimiter, checkAuth, popupMid, (req, res) => {
		const vukkies = require("./public/vukkies.json");
		const boxes = require("./public/boxes.json");
		let validBoxes = []
		Object.keys(boxes).forEach(box => {
			validBoxes.push(box)
		});
		if(validBoxes.includes(req.params.data)) {
			db.buyBox(req.user, req.params.data, function(prize, newBalance, newGallery, dupe) {
				if(prize.box == "error") {
					return res.status(500).render(__dirname + "error.ejs", {stacktrace: false, error: prize.error});
				}
				if(prize.box == "poor") {
					return res.redirect("https://vukkybox.com/balance?poor=true");
				}
				if(prize.box) {
					let fullUnlock = false;
					let ownedInTier = db.vukkyTierCount(newGallery)[prize.box.level.level] ? db.vukkyTierCount(newGallery)[prize.box.level.level] : 0
					if(!dupe && vukkies.rarity[prize.box.level.level] != undefined && ownedInTier == Object.entries(vukkies.rarity[prize.box.level.level]).length) fullUnlock = true;
				
						let vukkyId = prize.box.vukkyId
						let vukkyRarity = parseInt(prize.box.level.level) == 8 ? "pukky" : prize.box.level.level
						let jsonVukky = vukkies.rarity[vukkyRarity][vukkyId];
						let jsonLevel = vukkyJson.levels[vukkyRarity];
						let vukky = {
							name: jsonVukky.name,
							creator: jsonVukky.creator,
							id: vukkyId,
							url: jsonVukky.url,
							description: jsonVukky.description,
							audio: jsonVukky.audio,
							rarity: {
								level: vukkyRarity,
								name: jsonLevel.name,
								color: jsonLevel.color
							}
						}
						let box = {
							type: req.params.data,
							dupe: dupe,
							fullUnlock: fullUnlock,
						}
						res.render(__dirname + '/public/vukky.ejs', {
							user: req.user._id ? req.user : req.user[0],
							vukky: vukky,
							box: box,
							oldBalance: dupe ? newBalance - 0.1 * boxes[req.params.data].price : newBalance,
							newBalance: newBalance,
							gravatarHash: req.user._id ? crypto.createHash("md5").update(req.user.primaryEmail.toLowerCase()).digest("hex") : crypto.createHash("md5").update(req.user[0].primaryEmail.toLowerCase()).digest("hex") 
						});
				}
			});
		} else {
			return res.status(500).render(`${__dirname}/public/error.ejs`, { stacktrace: null, friendlyError: "Silly goose, that's not a box! <a href='/store'>Check the store</a> to find some boxes that DO exist." });
		}
});

app.post('/leaderboard', grl, function(req, res) {
	let user = false
	if(req.isAuthenticated()) user = req.user._id ? req.user : req.user[0];
	let validBoards = ["uniqueVukkiesGot", "rarity", "boxesOpened"]
	if(validBoards.includes(req.body.board) && req.body.limit != undefined && parseInt(req.body.limit) > 0 && parseInt(req.body.limit) <= 200) {
		db.leaderboard({limit: parseInt(req.body.limit), board: req.body.board, rarity: req.body.rarity}, user, response => {
			res.send(response);
		})
	} else {
		res.status(400).send("Invalid request")
	}
})

app.get('/leaderboard', grl, function(req, res) {
	res.render(__dirname + '/public/leaderboard.ejs', {user: req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null, gravatarHash: req.isAuthenticated() ? crypto.createHash("md5").update(req.user._id ? req.user.primaryEmail.toLowerCase() : req.user[0].primaryEmail.toLowerCase()).digest("hex") : null});
})

app.get('/privacy', function(req, res){
	res.redirect('/resources/privacy.html');
});

app.get('/terms', function(req, res){
	res.redirect('/resources/terms.html');
});

app.get('/delete', grl, checkAuth, function(req,res) {
	res.render(__dirname + "/public/deleteConfirm.ejs", {csrfToken: req.csrfToken()})
})

app.post("/delete", grl, checkAuth, function(req, res) {
	return res.send("<meta name='viewport' content='width=device-width, initial-scale=1.0'>Due to a bug we have no idea how works where random accounts would be deleted instead of yours, this feature is currently disabled.<br>To delete your account, please contact us at the following email address: contact@vukkybox.com<br><br>For us to accept your deletion request, you must send the email from the email address you used to log in.<br>You can see that email address by navigating to the <a href='https://vukkybox.com/stats'>stats page</a>. (it may be confusing, just skim it until you see your email!)")
	if(req.user.primaryEmail) {
	db.deleteUser(req.user, function(result) {
		if(result == 500) {
			res.redirect('/resources/500.html');
		} else {
			req.logout();
			res.redirect('/resources/deleted.html');
		}
	});
	} else {
	db.deleteUser(req.user[0], function(result) {
		if(result == 500) {
			res.redirect('/resources/500.html');
		} else {
			req.logout();
			res.redirect('/resources/deleted.html');
		}
	});
	}
})

app.get("/admin", grl, popupMid, function(req, res) {
	  
	if(!req.isAuthenticated()) return res.render(__dirname + "/public/adminfake.ejs");
	if(!req.user && !req.user[0]) return res.render(__dirname + "/public/adminfake.ejs");
	if(req.user && !req.user.discordId) return res.render(__dirname + "/public/adminfake.ejs");
	if(req.user[0] && !req.user[0].discordId) return res.render(__dirname + "/public/adminfake.ejs");
	if(["708333380525228082", "125644326037487616"].includes(req.user.discordId) || ["708333380525228082", "125644326037487616"].includes(req.user[0].discordId)) {
		res.render(__dirname + "/public/admin.ejs", {csrfToken: req.csrfToken()})
	} else {
		res.render(__dirname + "/public/adminfake.ejs")
	}
})

app.get("/admin/**", grl, popupMid, function(req, res) {
	return res.status(400).render(`${__dirname}/public/error.ejs`, { stacktrace: null, friendlyError: "You're gonna have to be <i>properly</i> logged in if you wanna do that... ;)" });
})

app.get("/adminauthed", grl, popupMid, function(req, res) {
	res.render(__dirname + "/public/adminfakeauthed.ejs");
})

app.get("/adminfailed",grl, popupMid,  function(req, res) { 
	res.render(__dirname + "/public/adminfakefailed.ejs");
})

app.post("/admin/:action", grl, async function(req, res) {
	if(!req.isAuthenticated()) return res.render(__dirname + "/public/adminfake.ejs");
	if(!req.user && !req.user[0]) return res.render(__dirname + "/public/adminfake.ejs");
	if(["708333380525228082", "125644326037487616"].includes(req.user.discordId) || ["708333380525228082", "125644326037487616"].includes(req.user[0].discordId)) {
		switch(req.params.action) {
			case "create_code":
				db.createCode(req.body.code, req.body.amount, req.body.uses, (resp, err) => {
					if(err) return res.status(400).render(`${__dirname}/public/error.ejs`, { stacktrace: err.stack, friendlyError: null });
					res.redirect("/admin?code=" + resp.code)
				})
			break;
			case "upload_file":
				if(req.body.vukkytype.length < 1 || !req.files.image) return res.status(400).render(`${__dirname}/public/error.ejs`, { stacktrace: null, friendlyError: "Silly goose, you're missing some arguments there! Would you mind <a href='/admin'>trying again</a>?" });
				if(req.body.vukkytype != "special") {
					const fileWithoutExt = req.files.image.name.replace(/\.[^/.]+$/, "")
					const folderLocation = req.body.vukkytype == "pukky" ? "/resources/pukkies/" : "/resources/"
					if(req.files.image.name.endsWith(".gif")) {
						req.files.image.mv(`${__dirname}/public/resources/temp/${req.files.image.name}`);
						await webp.gwebp(`${__dirname}/public/resources/temp/${req.files.image.name}`,`${__dirname}/public${folderLocation}${fileWithoutExt}.webp`);
						fs.unlinkSync(`${__dirname}/public/resources/temp/${req.files.image.name}`);
					} else if (req.files.image.name.endsWith(".webp")) {
						req.files.image.mv(`${__dirname}/public${folderLocation}${req.files.image.name}`);
					} else {
						req.files.image.mv(`${__dirname}/public/resources/temp/${req.files.image.name}`);
						await webp.cwebp(`${__dirname}/public/resources/temp/${req.files.image.name}`,`${__dirname}/public${folderLocation}${fileWithoutExt}.webp`);
						fs.unlinkSync(`${__dirname}/public/resources/temp/${req.files.image.name}`);
					}
					hook.send("<a:eager:902938792896385064> A new Vukky asset has been uploaded.")
					return res.redirect(`/admin?uploaded=https://vukkybox.com${folderLocation}${fileWithoutExt}.webp`);
				} else {
					req.files.image.mv(`${__dirname}/public/resources/${req.files.image.name}`);
					return res.redirect(`/admin`);
				}
				break;
			case "create_vukky": //i really dont want to make this one
				if(req.body.name.length < 1 || req.body.description.length < 1 || req.body.url.length < 1 || req.body.level.length < 1) return res.status(400).render(`${__dirname}/public/error.ejs`, { stacktrace: null, friendlyError: "Silly goose, you're missing some arguments there! Would you mind <a href='/admin'>trying again</a>?" });
				let newId = parseInt(vukkyJson.currentId) + 1
				vukkyJson.currentId = newId;
				vukkyJson.rarity[req.body.level][newId] = {
					name: req.body.name,
					url: req.body.url,
					description: req.body.description
				}
				if(req.body.level != "pukky") vukkyJson.rarity[req.body.level][newId].creator = req.body.creator;
				if(req.body.sfx.length != 0) vukkyJson.rarity[req.body.level][newId].audio = req.body.sfx;
				fs.writeFileSync("./public/vukkies.json", JSON.stringify(vukkyJson, null, "\t"));
				res.redirect("/view/" + req.body.level + "/" + newId)
				if(req.body.level != "pukky") {
					hook.send("<a:eagersplode:902938979563884584> A new Vukky by " + req.body.creator + " has been made! https://vukkybox.com/view/" + req.body.level + "/" + newId)
				} else {
					hook.send("<a:eagersplode:902938979563884584> A new Pukky has been made! https://vukkybox.com/view/" + req.body.level + "/" + newId)
				}
			break;
			case "emails":
				db.listEmails();
				res.redirect("/admin?emails=true")
			break;
			case "popup_reset":
				db.resetPopup();
				res.redirect("/admin?popup=true")
			break;
			case "beta_reset":
				db.resetBeta();
				res.redirect("/admin?beta=true")
			break;
			case "set_balance":
				if(req.body.userid && req.body.newbalance) {
					db.setBalance(req.body.userid, req.body.newbalance)
					adminHook.send(`<a:eagersplode:902938979563884584> \`${req.body.userid}\`'s balance has been set to ${req.body.newbalance}`)
					res.redirect("/admin?balance=true")
				} else {
					return res.status(400).render(`${__dirname}/public/error.ejs`, { stacktrace: null, friendlyError: "Silly goose, you're missing some arguments there! Would you mind <a href='/admin'>trying again</a>?" });
				}
			break;
			default:
				res.render(__dirname + "/public/adminfake.ejs");
				break;
		}
	} else {
		res.render(__dirname + "/public/adminfake.ejs"); //i really dont want to make this one
	}
});

app.get("/view/:level/:id", grl, popupMid, function (req, res) { 
	if(!vukkyJson.levels[req.params.level]) return res.status(400).render(`${__dirname}/public/error.ejs`, { stacktrace: null, friendlyError: "Silly goose, that's not a rarity! <a href='/gallery'>Check your gallery</a> to find some Vukkies that DO exist." });
	if(!vukkyJson.rarity[req.params.level][req.params.id]) return res.status(400).render(`${__dirname}/public/error.ejs`, { stacktrace: null, friendlyError: "Silly goose, that's not a Vukky! <a href='/gallery'>Check your gallery</a> to find some Vukkies that DO exist." });
	let jsonVukky = vukkyJson.rarity[req.params.level][req.params.id];
	let jsonLevel = vukkyJson.levels[req.params.level];
	let vukky = {
		name: jsonVukky.name,
		creator: jsonVukky.creator,
		id: req.params.id,
		url: jsonVukky.url,
		description: jsonVukky.description,
		audio: jsonVukky.audio,
		rarity: {
			level: req.params.level,
			name: jsonLevel.name,
			color: jsonLevel.color
		}
	}
	if(!req.user) return res.render(__dirname + '/public/vukky.ejs', {
		user: null,
		vukky: vukky,
		box: null,
		gravatarHash: null 
	});

	res.render(__dirname + '/public/vukky.ejs', {
		user: req.user._id ? req.user : req.user[0],
		vukky: vukky,
		box: null,
		gravatarHash: req.user._id ? crypto.createHash("md5").update(req.user.primaryEmail.toLowerCase()).digest("hex") : crypto.createHash("md5").update(req.user[0].primaryEmail.toLowerCase()).digest("hex") 
	});
  })

app.get('/stats', grl, checkAuth, popupMid, function(req, res) {
	if(req.user.primaryEmail) {
		db.getUser(req.user._id, function(resp, err) {
			if(err) return res.send(err)
			res.send(resp)
		})
	} else {	
		db.getUser(req.user[0]._id, function(resp, err) {
			if(err) return res.send(err)
			res.send(resp)
		})
	}
})

app.get('/beta', grl, checkAuth, popupMid, function(req, res) {
	if(req.headers.referer == "https://vukkybox.com/credits") return res.render(__dirname + '/public/beta.ejs', {csrfToken: req.csrfToken()})
	if(req.headers.referer == "https://vukkybox.com/admin") return res.render(__dirname + '/public/beta.ejs', {csrfToken: req.csrfToken()})
	res.status(404).render(`${__dirname}/public/404.ejs`);
})

app.post('/beta', grl, popupMid, function(req, res) {
	if(!req.isAuthenticated()) return res.status(403).send("Unauthenticated");
	let newBetaState = req.body.betaState;
	db.setBeta(req.user._id ? req.user._id : req.user[0]._id, newBetaState == "enable" ? true : newBetaState == "disable" ? false : null, function(resp, err, newUser) {
		if(!err) req.session.passport.user = newUser;
		res.send(resp == 200 ? "<pre>Your wish is my command.</pre><button onclick=\"document.location.href = '/'\">OK</button>" : res.status(500).render(__dirname + "public/error.ejs", {stacktrace: err, friendlyError: "Something went wrong when applying this change to your account."}))
	});
})

app.get('/', grl, popupMid, function(req, res) {
	req.session.redirectTo = "/"
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	if(!user) return res.render(__dirname + '/public/index.ejs', {user: user, gravatarHash: user ? crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex") : null});
	db.lastLogin(user, function(newBalance, newUser) {
		req.session.passport.user = newUser
		req.session.passport.user.balance = newBalance
		res.render(__dirname + '/public/index.ejs', {user: user, gravatarHash: user ? crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex") : null});
	})
});

app.get('/balance', grl, popupMid, function(req, res) {
	req.session.redirectTo = "/"
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	if (!user) return res.render(__dirname + '/public/balance.ejs', {user: user, gravatarHash: user ? crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex") : null});
	db.getUser(user._id, (resp, err) => {
		if (err) return res.send(err)
		loginHourly = resp.loginHourly
		loginDaily = resp.loginDaily
		res.render(__dirname + '/public/balance.ejs', {RVNid: resp.RVNid, loginHourly: loginHourly, loginDaily: loginDaily, user: user, gravatarHash: user ? crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex") : null});
	})
});

app.get('/gallery', grl, checkAuth, popupMid, function(req, res) {
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	res.render(__dirname + '/public/gallery.ejs', {totalVukkies: vukkyJson.currentId, vukkies: vukkyJson.rarity, user: user, username: user.username, gravatarHash: crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex")});
});

app.get("/guestgallery/:userId", grl, popupMid, function(req, res) {
	db.getUser(req.params.userId, function(user, err) {
		if(err) return res.status(500).send("500 " + err)
		if (user.username == user.primaryEmail) user.username = "A Vukkybox User";
		res.render(__dirname + '/public/gallery.ejs', {totalVukkies: vukkyJson.currentId, vukkies: vukkyJson.rarity, user: user, gravatarHash: crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex")});
	})
})

app.get('/loginDiscord', passport.authenticate('discord', { scope: scopes, prompt: prompt }), function(req, res) {});
app.get('/loginGithub', passport.authenticate('github'), function(req, res) {});
app.get('/loginGoogle', passport.authenticate('google'), function(req, res) {});

app.get('/callbackdiscord',
	passport.authenticate('discord', { failureRedirect: '/' }), function(req, res) { 
		if(req.session.redirectTo) {
			let dest = req.session.redirectTo;
			req.session.redirectTo = "/"
			res.redirect(dest) 
		} else {
			res.redirect('/')
		}
	} // auth success
);

app.get('/callbackgithub',
	passport.authenticate('github', { failureRedirect: '/' }), function(req, res) { 
		if(req.session.redirectTo) {
			let dest = req.session.redirectTo;
			req.session.redirectTo = "/"
			res.redirect(dest) 
		} else {
			res.redirect('/')
		}
	} // auth success
);
app.get('/callbackgoogle',
	passport.authenticate('google', { failureRedirect: '/' }), function(req, res) { 
		if(req.session.redirectTo) {
			let dest = req.session.redirectTo;
			req.session.redirectTo = "/"
			res.redirect(dest) 
		} else {
			res.redirect('/')
		}
	} // auth success
);
app.get('/logout', grl, function(req, res) {
	req.logout();
	res.redirect('/');
});
app.get('/info', grl, checkAuth, function(req, res) {
	//console.log(req.user
	res.redirect("/")
	//db.findOrCreate(req.user.provider, req.user)
});
app.get('/redeem/:code', grl, checkAuth, popupMid, function (req, res) {
	  
	let code = req.params["code"];
	db.validCode(code, req.user, (isValid) => {
		db.redeemCode(req.user, code, (success, amount) => {
			if(success) {
				if(req.user.primaryEmail) {
					req.session.passport.user.balance += amount
				} else {
					req.session.passport.user[0].balance += amount
				}
				res.render(__dirname + '/public/redeem.ejs', {invalid: isValid, code: code, amount: amount});
				adminHook.send(`<a:clappy:919605268902469662> A user has redeemed \`${code}\` for ${amount} Vukkybux!`);
			} else {
				res.render(__dirname + '/public/redeem.ejs', {invalid: isValid, code: null, amount: null});
				adminHook.send(`<a:hahah:919608495576326174> A user tried to redeem \`${req.params["code"]}\`, but it was ${isValid}.`);
				if (req.user._id) console.log(req.user._id)
				if (req.user[0]) console.log(req.user[0]._id)
			}
		});
	});
})

app.get("/popup", grl, checkAuth, function (req, res) {
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	res.render(__dirname + '/public/popup.ejs', {csrfToken: req.csrfToken(), user: user, gravatarHash: crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex"), redirect: req.session.redirectTo != undefined && req.session.redirectTo.length > 1 ? true : false});
	
})

app.post('/popup', grl, checkAuth, function (req, res) {
	if(req.body.popup != "yes") return res.redirect("/delete")
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	db.acceptPopup(user._id)
	res.redirect("/")
})

app.get('/store', grl, popupMid, function(req,res) {
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	if (!user) return res.render(__dirname + '/public/store.ejs', {user: user, gravatarHash: user ? crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex") : null});
	db.lastLogin(req.user, function(newBalance, newUser) {
		req.session.passport.user = newUser
		req.session.passport.user.balance = newBalance
		user.balance = newBalance
		res.render(__dirname + '/public/store.ejs', {user: user, gravatarHash: user ? crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex") : null});
	})
});

app.get('/credits', grl, popupMid, function(req,res) {
	const vboxVer = require("./package.json").version;
	const gitHash = require('child_process').execSync('git rev-parse --short HEAD').toString().trim()
	const deps = require("./package.json").dependencies;
	const ddeps = require("./package.json").devDependencies;
	const vukkies = require("./public/vukkies.json").rarity;
	let vukkyCreatorData = {};
	Object.keys(vukkies).forEach(function(key) {
		Object.keys(vukkies[key]).forEach(function(keytoo) {
			if(vukkies[key][keytoo].creator) {
				if(vukkyCreatorData[vukkies[key][keytoo].creator] == undefined) vukkyCreatorData[vukkies[key][keytoo].creator] = []
				vukkyCreatorData[vukkies[key][keytoo].creator].push(`${key}/${keytoo}`)
			}
		});
	});
	vukkyCreatorData = Object.entries(vukkyCreatorData).sort((a, b) => b[1].length - a[1].length);
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	if(!user) return res.render(__dirname + '/public/credits.ejs', {vukkyCreatorData: vukkyCreatorData, vboxVer: vboxVer, gitHash: gitHash, deps: deps, ddeps: ddeps, user: null, gravatarHash: null});
	db.lastLogin(user, function(newBalance, newUser) {
		req.session.passport.user = newUser
		req.session.passport.user.balance = newBalance
		user.balance = newBalance
		res.render(__dirname + '/public/credits.ejs', {vukkyCreatorData: vukkyCreatorData, vboxVer: vboxVer, gitHash: gitHash, deps: deps, ddeps: ddeps, user: user, gravatarHash: crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex")});
	})
});

app.get('/pwasw.js', grl, function(req, res){
	res.sendFile(__dirname + '/public/resources/pwasw.js')
});

function checkAuth(req, res, next) {
	let user = req.isAuthenticated() ? req.user._id ? req.user : req.user[0] : null
	if(user) {
		db.lastLogin(user, function(newBalance, newUser) {
			req.session.passport.user = newUser
			req.session.passport.user.balance = newBalance
		})
		return next();
	}
	req.session.redirectTo = req.path;
	res.redirect(`/login`)
}

app.get('/sus', function(req, res){
	res.redirect('https://i.imgur.com/IEl9NzL.gif');
});

app.get('/crash', grl, function(req, res){
	res.status(500).render(`${__dirname}/public/error.ejs`, { stacktrace: "CRITICAL SERVER FAULT AT APP.JS:1! QUITTING IMMEDIATELY TO PREVENT FURTHER DAMAGE", friendlyError: null });
});

app.get('/statistics', grl, checkAuth, function(req, res){
	let user = req.user._id ? req.user : req.user[0];
	if(!user.beta) return res.status(404).render(`${__dirname}/public/error.ejs`, {friendlyError: "This page hasn't been created yet! <small>or maybe youre just not cool enough to see it! Maybe pay some respect to the <a href='https://vukkybox.com/credits'>people who made this site happen</a></small><br>In the meantime check out the <a href='https://vukkybox.com/leaderboard'>leaderboards</a> or <a href='https://vukkybox.com/stats'>detailed stats</a>" });
	let userRanks = {}
	db.leaderboard({"board": "uniqueVukkiesGot", "limit": 1, "rarity": 42}, user, function(leaderboardObject) {
		userRanks.uniqueVukkiesGot = leaderboardObject.userRank.rank;
		db.leaderboard({"board": "boxesOpened", "limit": 1, "rarity": 42}, user, function(leaderboardObject) {
			userRanks.boxesOpened = leaderboardObject.userRank.rank;
			db.getUser(user._id, user => {
				res.render(`${__dirname}/public/statistics.ejs`, {user: user, totalVukkies: vukkyJson.currentId, userRanks: userRanks, gravatarHash: crypto.createHash("md5").update(user.primaryEmail.toLowerCase()).digest("hex")});
})})})});

app.get('*', function(req, res){
	res.status(404).render(`${__dirname}/public/404.ejs`);
});

app.use(function (err, req, res, next) {
	console.error(err.stack);
	if(err.message == 'Invalid "code" in request.') {
		return res.status(500).render(`${__dirname}/public/error.ejs`, { stacktrace: null, friendlyError: "It looks like we couldn't log you in. Would you mind <a href='/login'>trying that again</a>?" });
	}
	res.status(500).render(`${__dirname}/public/error.ejs`, { stacktrace: err.stack, friendlyError: null });
});

var fs = require('fs');
var http = require('http');

const httpServer = http.createServer(app);

httpServer.listen(81, () => {
	console.log('HTTP Server running on port 81');
});
