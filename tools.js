// Misc Tools for Node.js
// Copyright (c) 2015 Joseph Huckaby
// Released under the MIT License

var Crypto = require('crypto');

module.exports = {
	
	timeNow: function(floor) {
		// return current epoch time
		var epoch = (new Date()).getTime() / 1000;
		return floor ? Math.floor(epoch) : epoch;
	},
	
	_uniqueIDCounter: 0,
	generateUniqueID: function(len, salt) {
		// generate unique ID using some readily-available bits of entropy
		this._uniqueIDCounter++;
		var shasum = Crypto.createHash('sha256');
		
		shasum.update([
			'SALT_7fb1b7485647b1782c715474fba28fd1',
			this.timeNow(),
			Math.random(),
			process.pid,
			this._uniqueIDCounter,
			salt || ''
		].join('-'));
		
		return shasum.digest('hex').substring(0, len || 64);
	},
	
	digestHex: function(str) {
		// digest string using SHA256, return hex hash
		var shasum = Crypto.createHash('sha256');
		shasum.update( str );
		return shasum.digest('hex');
	},
	
	numKeys: function(hash) {
		// count keys in hash
		var count = 0;
		for (var key in hash) { count++; }
		return count;
	},
	
	firstKey: function(hash) {
		// return first key in hash (key order is undefined)
		for (var key in hash) return key;
		return null; // no keys in hash
	},
	
	hashKeysToArray: function(hash) {
		// convert hash keys to array (discard values)
		var arr = [];
		for (var key in hash) arr.push(key);
		return arr;
	},
	
	hashValuesToArray: function(hash) {
		// convert hash values to array (discard keys)
		var arr = [];
		for (var key in hash) arr.push( hash[key] );
		return arr;
	},
	
	isaHash: function(arg) {
		// determine if arg is a hash or hash-like
		return( !!arg && (typeof(arg) == 'object') && (typeof(arg.length) == 'undefined') );
	},
	
	isaArray: function(arg) {
		// determine if arg is an array or is array-like
		if (typeof(arg) == 'array') return true;
		return( !!arg && (typeof(arg) == 'object') && (typeof(arg.length) != 'undefined') );
	},
	
	copyHash: function(hash, deep) {
		// copy hash to new one, with optional deep mode (uses JSON)
		if (deep) {
			// deep copy
			return JSON.parse( JSON.stringify(hash) );
		}
		else {
			// shallow copy
			var output = {};
			for (var key in hash) {
				output[key] = hash[key];
			}
			return output;
		}
	},
	
	copyHashRemoveKeys: function(hash, remove) {
		// shallow copy hash, excluding some keys
		var output = {};
		for (var key in hash) {
			if (!remove[key]) output[key] = hash[key];
		}
		return output;
	},
	
	mergeHashes: function(a, b) {
		// shallow-merge keys from a and b into c and return c
		// b has precedence over a
		if (!a) a = {};
		if (!b) b = {};
		var c = {};
		
		for (var key in a) c[key] = a[key];
		for (var key in b) c[key] = b[key];
		
		return c;
	},
	
	mergeHashInto: function(a, b) {
		// shallow-merge keys from b into a
		for (var key in b) a[key] = b[key];
	},
	
	parseQueryString: function(url) {
		// parse query string into key/value pairs and return as object
		var query = {}; 
		url.replace(/^.*\?/, '').replace(/([^\=]+)\=([^\&]*)\&?/g, function(match, key, value) {
			query[key] = decodeURIComponent(value);
			if (query[key].match(/^\-?\d+$/)) query[key] = parseInt(query[key]);
			else if (query[key].match(/^\-?\d*\.\d+$/)) query[key] = parseFloat(query[key]);
			return ''; 
		} );
		return query; 
	},
	
	composeQueryString: function(query) {
		// compose key/value pairs into query string
		var qs = '';
		for (var key in query) {
			qs += (qs.length ? '&' : '?') + key + '=' + encodeURIComponent(query[key]);
		}
		return qs;
	},
	
	findObjectsIdx: function(arr, crit, max) {
		// find idx of all objects that match crit keys/values
		var idxs = [];
		var num_crit = 0;
		for (var a in crit) num_crit++;
		
		for (var idx = 0, len = arr.length; idx < len; idx++) {
			var matches = 0;
			for (var key in crit) {
				if (arr[idx][key] == crit[key]) matches++;
			}
			if (matches == num_crit) {
				idxs.push(idx);
				if (max && (idxs.length >= max)) return idxs;
			}
		} // foreach elem
		
		return idxs;
	},
	
	findObjectIdx: function(arr, crit) {
		// find idx of first matched object, or -1 if not found
		var idxs = this.findObjectsIdx(arr, crit, 1);
		return idxs.length ? idxs[0] : -1;
	},
	
	findObject: function(arr, crit) {
		// return first found object matching crit keys/values, or null if not found
		var idx = this.findObjectIdx(arr, crit);
		return (idx > -1) ? arr[idx] : null;
	},
	
	findObjects: function(arr, crit) {
		// find and return all objects that match crit keys/values
		var idxs = this.findObjectsIdx(arr, crit);
		var objs = [];
		for (var idx = 0, len = idxs.length; idx < len; idx++) {
			objs.push( arr[idxs[idx]] );
		}
		return objs;
	},
	
	deleteObject: function(arr, crit) {
		// walk array looking for nested object matching criteria object
		// delete first object found
		var idx = this.findObjectIdx(arr, crit);
		if (idx > -1) {
			arr.splice( idx, 1 );
			return true;
		}
		return false;
	},
	
	deleteObjects: function(arr, crit) {
		// delete all objects in obj array matching criteria
		// TODO: This is not terribly efficient -- could use a rewrite.
		var count = 0;
		while (this.deleteObject(arr, crit)) count++;
		return count;
	},
	
	alwaysArray: function(obj) {
		// if obj is not an array, wrap it in one and return it
		return this.isaArray(obj) ? obj : [obj];
	},
	
	lookupPath: function(path, obj) {
		// walk through object tree, psuedo-XPath-style
		// supports arrays as well as objects
		// return final object or value
		// always start query with a slash, i.e. /something/or/other
		path = path.replace(/\/$/, ""); // strip trailing slash
		
		while (/\/[^\/]+/.test(path) && (typeof(obj) == 'object')) {
			// find first slash and strip everything up to and including it
			var slash = path.indexOf('/');
			path = path.substring( slash + 1 );
			
			// find next slash (or end of string) and get branch name
			slash = path.indexOf('/');
			if (slash == -1) slash = path.length;
			var name = path.substring(0, slash);

			// advance obj using branch
			if (typeof(obj.length) == 'undefined') {
				// obj is hash
				if (typeof(obj[name]) != 'undefined') obj = obj[name];
				else return null;
			}
			else {
				// obj is array
				var idx = parseInt(name, 10);
				if (isNaN(idx)) return null;
				if (typeof(obj[idx]) != 'undefined') obj = obj[idx];
				else return null;
			}

		} // while path contains branch

		return obj;
	},
	
	substitute: function(text, args) {
		// perform simple [placeholder] substitution using supplied
		// args object (or eval) and return transformed text
		if (typeof(text) == 'undefined') text = '';
		text = '' + text;
		if (!args) args = {};
		
		while (text.indexOf('[') > -1) {
			var open_bracket = text.indexOf('[');
			var close_bracket = text.indexOf(']');
			
			var before = text.substring(0, open_bracket);
			var after = text.substring(close_bracket + 1, text.length);
			
			var name = text.substring( open_bracket + 1, close_bracket );
			var value = '';
			if (name.indexOf('/') == 0) value = this.lookupPath(name, args);
			else if (typeof(args[name]) != 'undefined') value = args[name];
			else value = '__APLB__' + name + '__APRB__';
			
			text = before + value + after;
		} // while text contains [
		
		return text.replace(/__APLB__/g, '[').replace(/__APRB__/g, ']');
	},
	
	getDateArgs: function(thingy) {
		// return hash containing year, mon, mday, hour, min, sec
		// given epoch seconds, date object or date string
		var date = (typeof(thingy) == 'object') ? thingy : (new Date( (typeof(thingy) == 'number') ? (thingy * 1000) : thingy ));
		var args = {
			epoch: Math.floor( date.getTime() / 1000 ),
			year: date.getFullYear(),
			mon: date.getMonth() + 1,
			mday: date.getDate(),
			wday: date.getDay(),
			hour: date.getHours(),
			min: date.getMinutes(),
			sec: date.getSeconds(),
			msec: date.getMilliseconds()
		};
		
		args.yyyy = '' + args.year;
		if (args.mon < 10) args.mm = "0" + args.mon; else args.mm = '' + args.mon;
		if (args.mday < 10) args.dd = "0" + args.mday; else args.dd = '' + args.mday;
		if (args.hour < 10) args.hh = "0" + args.hour; else args.hh = '' + args.hour;
		if (args.min < 10) args.mi = "0" + args.min; else args.mi = '' + args.min;
		if (args.sec < 10) args.ss = "0" + args.sec; else args.ss = '' + args.sec;
		
		if (args.hour >= 12) {
			args.ampm = 'pm';
			args.hour12 = args.hour - 12;
			if (!args.hour12) args.hour12 = 12;
		}
		else {
			args.ampm = 'am';
			args.hour12 = args.hour;
			if (!args.hour12) args.hour12 = 12;
		}
		
		args.yyyy_mm_dd = args.yyyy + '/' + args.mm + '/' + args.dd;
		args.hh_mi_ss = args.hh + ':' + args.mi + ':' + args.ss;
		
		return args;
	},
	
	getTimeFromArgs: function(args) {
		// return epoch given args like those returned from getDateArgs()
		var then = new Date(
			args.year,
			args.mon - 1,
			args.mday,
			args.hour,
			args.min,
			args.sec,
			0
		);
		return Math.floor( then.getTime() / 1000 );
	},
	
	normalizeTime: function(epoch, zero_args) {
		// quantize time into any given precision
		// examples: 
		//   hour: { min:0, sec:0 }
		//   day: { hour:0, min:0, sec:0 }
		var args = this.getDateArgs(epoch);
		for (key in zero_args) args[key] = zero_args[key];
		
		// mday is 1-based
		if (!args['mday']) args['mday'] = 1;
		
		return this.getTimeFromArgs(args);
	},
	
	getTextFromBytes: function(bytes, precision) {
		// convert raw bytes to english-readable format
		// set precision to 1 for ints, 10 for 1 decimal point (default), 100 for 2, etc.
		bytes = Math.floor(bytes);
		if (!precision) precision = 10;
		
		if (bytes >= 1024) {
			bytes = Math.floor( (bytes / 1024) * precision ) / precision;
			if (bytes >= 1024) {
				bytes = Math.floor( (bytes / 1024) * precision ) / precision;
				if (bytes >= 1024) {
					bytes = Math.floor( (bytes / 1024) * precision ) / precision;
					if (bytes >= 1024) {
						bytes = Math.floor( (bytes / 1024) * precision ) / precision;
						return bytes + ' TB';
					} 
					else return bytes + ' GB';
				} 
				else return bytes + ' MB';
			}
			else return bytes + ' K';
		}
		else return bytes + this.pluralize(' byte', bytes);
	},
	
	getBytesFromText: function(text) {
		// parse text into raw bytes, e.g. "1 K" --> 1024
		if (text.toString().match(/^\d+$/)) return parseInt(text); // already in bytes
		var multipliers = {
			b: 1,
			k: 1024,
			m: 1024 * 1024,
			g: 1024 * 1024 * 1024,
			t: 1024 * 1024 * 1024 * 1024
		};
		var bytes = 0;
		text = text.toString().replace(/([\d\.]+)\s*(\w)\w*\s*/g, function(m_all, m_g1, m_g2) {
			var mult = multipliers[ m_g2.toLowerCase() ] || 0;
			bytes += (parseFloat(m_g1) * mult); 
			return '';
		} );
		return Math.floor(bytes);
	},
	
	commify: function(number) {
		// add US-formatted commas to integer, like 1,234,567
		if (!number) number = 0;
		number = '' + number;
		
		if (number.length > 3) {
			var mod = number.length % 3;
			var output = (mod > 0 ? (number.substring(0,mod)) : '');
			for (i=0 ; i < Math.floor(number.length / 3); i++) {
				if ((mod == 0) && (i == 0))
					output += number.substring(mod+ 3 * i, mod + 3 * i + 3);
				else
					output+= ',' + number.substring(mod + 3 * i, mod + 3 * i + 3);
			}
			return (output);
		}
		else return number;
	},
	
	shortFloat: function(value) {
		// Shorten floating-point decimal to 2 places, unless they are zeros.
		if (!value) value = 0;
		return parseFloat( value.toString().replace(/^(\-?\d+\.[0]*\d{2}).*$/, '$1') );
	},
	
	pct: function(count, max, floor) {
		// Return formatted percentage given a number along a sliding scale from 0 to 'max'
		var pct = (count * 100) / (max || 1);
		if (!pct.toString().match(/^\d+(\.\d+)?$/)) { pct = 0; }
		return '' + (floor ? Math.floor(pct) : this.shortFloat(pct)) + '%';
	},
	
	getTextFromSeconds: function(sec, abbrev, no_secondary) {
		// convert raw seconds to human-readable relative time
		var neg = '';
		sec = Math.floor(sec);
		if (sec<0) { sec =- sec; neg = '-'; }
		
		var p_text = abbrev ? "sec" : "second";
		var p_amt = sec;
		var s_text = "";
		var s_amt = 0;
		
		if (sec > 59) {
			var min = Math.floor(sec / 60);
			sec = sec % 60; 
			s_text = abbrev ? "sec" : "second"; 
			s_amt = sec; 
			p_text = abbrev ? "min" : "minute"; 
			p_amt = min;
			
			if (min > 59) {
				var hour = Math.floor(min / 60);
				min = min % 60; 
				s_text = abbrev ? "min" : "minute"; 
				s_amt = min; 
				p_text = abbrev ? "hr" : "hour"; 
				p_amt = hour;
				
				if (hour > 23) {
					var day = Math.floor(hour / 24);
					hour = hour % 24; 
					s_text = abbrev ? "hr" : "hour"; 
					s_amt = hour; 
					p_text = "day"; 
					p_amt = day;
				} // hour>23
			} // min>59
		} // sec>59
		
		var text = p_amt + " " + p_text;
		if ((p_amt != 1) && !abbrev) text += "s";
		if (s_amt && !no_secondary) {
			text += ", " + s_amt + " " + s_text;
			if ((s_amt != 1) && !abbrev) text += "s";
		}
		
		return(neg + text);
	},
	
	getSecondsFromText: function(text) {
		// parse text into raw seconds, e.g. "1 minute" --> 60
		if (text.toString().match(/^\d+$/)) return parseInt(text); // already in seconds
		var multipliers = {
			s: 1,
			m: 60,
			h: 60 * 60,
			d: 60 * 60 * 24,
			w: 60 * 60 * 24 * 7
		};
		var seconds = 0;
		text = text.toString().replace(/([\d\.]+)\s*(\w)\w*\s*/g, function(m_all, m_g1, m_g2) {
			var mult = multipliers[ m_g2.toLowerCase() ] || 0;
			seconds += (parseFloat(m_g1) * mult); 
			return '';
		} );
		return Math.floor(seconds);
	},
	
	getNiceRemainingTime: function(elapsed, counter, counter_max, abbrev, shorten) {
		// estimate remaining time given starting epoch, a counter and the 
		// counter maximum (i.e. percent and 100 would work)
		// return in english-readable format
		if (counter == counter_max) return 'Complete';
		if (counter == 0) return 'n/a';
		
		var sec_remain = Math.floor(((counter_max - counter) * elapsed) / counter);
		
		return this.getTextFromSeconds( sec_remain, abbrev, shorten );
	},
	
	randArray: function(arr) {
		// return random element from array
		return arr[ Math.floor(Math.random() * arr.length) ];
	},
	
	pluralize: function(word, num) {
		// apply english pluralization to word if 'num' is not equal to 1
		if (num != 1) {
			return word.replace(/y$/, 'ie') + 's';
		}
		else return word;
	},
	
	escapeRegExp: function(text) {
		// escape text for regular expression
		return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
	
};
