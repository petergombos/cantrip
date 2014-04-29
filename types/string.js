(function(name, definition) {
    if (typeof module != 'undefined') module.exports = definition();
    else if (typeof define == 'function' && typeof define.amd == 'object') define(definition);
    else this[name] = definition();
}('cantrip-text', function() {

	var _ = _ || require("underscore");

	var validationFunctions = {
		max: function(value, n) {
			if (value.length > n) {
				return {valid: false, message: "Text length must be shorter than " + n};
			} else {
				return {valid: true};
			}
		},
		min: function(value, n) {
			if (value.length < n) {
				return {valid: false, message: "Text length must be longer than " + n};
			} else {
				return {valid: true};
			}
		},
		length: function(value, n) {
			if (value.length !== n) {
				return {valid: false, message: "Text length must be " + n};
			} else {
				return {valid: true};
			}
		}
	};

    return {
        
    	validate: function(value, validations) {
    		 var valid = true,
    		 	 message = "";

    		 for (var i = 0; i < validations.length; i++) {
    		 	if (_.isString(validations[i])) {
    		 		var name = validations[i].split(":")[0];
    		 		var args = validations[i].split(":")[1].split(",");
    		 		args.unshift(value);
    		 		var result = validationFunctions[name].apply(this, args);
    		 		if (!result.valid) {
    		 			valid = false;
    		 			message = result.message;
    		 		}
    		 	}
    		 }

    		 return {
    		 	valid: valid,
    		 	message: message
    		 }
    	},



    };
}));