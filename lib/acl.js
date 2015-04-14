var _ = require("lodash");

module.exports = function(options) {

	options = _.extend({
		groupsField: "groups",
		idField: "id",
		userField: "user"
	}, options);

	return function(req, dataStore, callback) {

		//Get the acl table from the dataStore. If it doesn't exist, no restrictions are assumed, so the function returns true.
		var acl = dataStore.get("/_acl");
		if (!acl) {
			callback && typeof callback === "function" && callback(null, true);
			return true;
		}

		//Get the groups the current user is in. Searches the request object for it, based on the option "groupsField"
		var groups = [];
		var keys = options.groupsField.split(".");
		
		try {
			groups = req[options.userField][options.groupsField];
		} catch(err) {
		}
		if (_.isString(groups)) {
			groups = [groups];
		}
		if (!_.isArray(groups)) {
			console.log("Wrong data supplied as groups.");
			callback(new Error("Wrong data supplied as groups."), false);
			return false;
		}

		var url = req.path + "";
		//strip "/" character from the end of the url
		if (url[url.length - 1] === "/") url = url.substr(0, url.length - 1);

		var foundRestriction = false; //This indicates whether there was any restriction found during the process. If not, the requests defaults to pass.
		//Loop through all possible urls starting from the beginning, eg: /, /users, /users/:id, /users/:id/comments, /users/:id/comments/:id.
		for (var i = 0; i < url.split("/").length; i++) {
			//Get the current url fragment
			var fragment = _.first(url.split("/"), (i + 1)).join("/");
			if (fragment === "") fragment = "/"; //fragment for the root element
			//Build a regex that will be used to match urls in the _acl table
			var regex = "^";
			fragment.substr(1).split("/").forEach(function(f) {
				if (f !== "") {
					regex += "/(" + f + "|:[a-zA-Z]+)";
				}
			});
			regex += "$";
			if (regex === "^$") regex = "^/$"; //regex for the root element
			var matcher = new RegExp(regex);
			//Loop through the _acl table
			for (var key in acl) {
				if (key.match(matcher)) {
					if (acl[key][req.method]) {
						foundRestriction = true;
						//Check if the user is in a group that is inside this restriction
						if (_.intersection(groups || [], acl[key][req.method]).length > 0) {
							callback && typeof callback === "function" && callback(null, true);
							return true;
						}

						//Check if the user is the owner of the object, when "owner" as a group is specified
						// if (acl[key][req.method].indexOf("owner") > -1) {
						// 	var node;
						// 	dataStore.get(fragment, function(err, res) {
						// 		if (err) console.log("Error ", err);
						// 		node = res;
						// 	});
						// 	if (node && node._owner === req.user._id) {
						// 		return next();
						// 	}
						// }
					}
				}
			}
		}

		//Check if we found any restrictions along the way
		if (foundRestriction) {
			callback && typeof callback === "function" && callback(new Error("Access denied."), false);
			return false;
		} else {
			callback && typeof callback === "function" && callback(null, true);
			return true;
		}
	}
}