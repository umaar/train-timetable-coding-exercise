/*!
 * mustache.js - Logic-less {{mustache}} templates with JavaScript
 * http://github.com/janl/mustache.js
 */

const objectToString = Object.prototype.toString;
const isArray = Array.isArray || function isArrayPolyfill(object) {
	return objectToString.call(object) === '[object Array]';
};

function isFunction(object) {
	return typeof object === 'function';
}

/**
 * More correct typeof string handling array
 * which normally returns typeof 'object'
 */
function typeString(object) {
	return isArray(object) ? 'array' : typeof object;
}

function escapeRegExp(string) {
	return string.replace(/[\-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Null safe way of checking whether or not an object,
 * including its prototype, has a given property
 */
function hasProperty(object, propertyName) {
	return object != null && typeof object === 'object' && (propertyName in object);
}

/**
 * Safe way of detecting whether or not the given thing is a primitive and
 * whether it has the given property
 */
function primitiveHasOwnProperty(primitive, propertyName) {
	return (
		primitive != null
    && typeof primitive !== 'object'
    && primitive.hasOwnProperty
    && primitive.hasOwnProperty(propertyName)
	);
}

// Workaround for https://issues.apache.org/jira/browse/COUCHDB-577
// See https://github.com/janl/mustache.js/issues/189
const regExpTest = RegExp.prototype.test;
function testRegExp(re, string) {
	return regExpTest.call(re, string);
}

const nonSpaceRe = /\S/;
function isWhitespace(string) {
	return !testRegExp(nonSpaceRe, string);
}

const entityMap = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	'\'': '&#39;',
	'/': '&#x2F;',
	'`': '&#x60;',
	'=': '&#x3D;',
};

function escapeHtml(string) {
	return String(string).replace(/[&<>"'`=/]/g, function fromEntityMap(s) {
		return entityMap[s];
	});
}

const whiteRe = /\s*/;
const spaceRe = /\s+/;
const equalsRe = /\s*=/;
const curlyRe = /\s*}/;
const tagRe = /[!#&/=>^{]/;

/**
 * Breaks up the given `template` string into a tree of tokens. If the `tags`
 * argument is given here it must be an array with two string values: the
 * opening and closing tags used in the template (e.g. [ "<%", "%>" ]). Of
 * course, the default is to use mustaches (i.e. mustache.tags).
 *
 * A token is an array with at least 4 elements. The first element is the
 * mustache symbol that was used inside the tag, e.g. "#" or "&". If the tag
 * did not contain a symbol (i.e. {{myValue}}) this element is "name". For
 * all text that appears outside a symbol this element is "text".
 *
 * The second element of a token is its "value". For mustache tags this is
 * whatever else was inside the tag besides the opening symbol. For text tokens
 * this is the text itself.
 *
 * The third and fourth elements of the token are the start and end indices,
 * respectively, of the token in the original template.
 *
 * Tokens that are the root node of a subtree contain two more elements: 1) an
 * array of tokens in the subtree and 2) the index in the original template at
 * which the closing tag for that section begins.
 *
 * Tokens for partials also contain two more elements: 1) a string value of
 * indendation prior to that tag and 2) the index of that tag on that line -
 * eg a value of 2 indicates the partial is the third tag on this line.
 */
function parseTemplate(template, tags) {
	if (!template) {
		return [];
	}

	let lineHasNonSpace = false;
	const sections = []; // Stack to hold section tokens
	const tokens = []; // Buffer to hold the tokens
	let spaces = []; // Indices of whitespace tokens on the current line
	let hasTag = false; // Is there a {{tag}} on the current line?
	let nonSpace = false; // Is there a non-space char on the current line?
	let indentation = ''; // Tracks indentation for tags that use it
	let tagIndex = 0; // Stores a count of number of tags encountered on a line

	// Strips all whitespace tokens array for the current line
	// if there was a {{#tag}} on it and otherwise only space.
	function stripSpace() {
		if (hasTag && !nonSpace) {
			while (spaces.length > 0) {
				delete tokens[spaces.pop()];
			}
		} else {
			spaces = [];
		}

		hasTag = false;
		nonSpace = false;
	}

	let openingTagRe; let closingTagRe; let closingCurlyRe;
	function compileTags(tagsToCompile) {
		if (typeof tagsToCompile === 'string') {
			tagsToCompile = tagsToCompile.split(spaceRe, 2);
		}

		if (!isArray(tagsToCompile) || tagsToCompile.length !== 2) {
			throw new Error('Invalid tags: ' + tagsToCompile);
		}

		openingTagRe = new RegExp(escapeRegExp(tagsToCompile[0]) + '\\s*');
		closingTagRe = new RegExp('\\s*' + escapeRegExp(tagsToCompile[1]));
		closingCurlyRe = new RegExp('\\s*' + escapeRegExp('}' + tagsToCompile[1]));
	}

	compileTags(tags || mustache.tags);

	const scanner = new Scanner(template);

	let start; let type; let value; let chr; let token; let openSection;
	while (!scanner.eos()) {
		start = scanner.pos;

		// Match any text between tags.
		value = scanner.scanUntil(openingTagRe);

		if (value) {
			for (let index = 0, valueLength = value.length; index < valueLength; ++index) {
				chr = value.charAt(index);

				if (isWhitespace(chr)) {
					spaces.push(tokens.length);
					indentation += chr;
				} else {
					nonSpace = true;
					lineHasNonSpace = true;
					indentation += ' ';
				}

				tokens.push(['text', chr, start, start + 1]);
				start += 1;

				// Check for whitespace on the current line.
				if (chr === '\n') {
					stripSpace();
					indentation = '';
					tagIndex = 0;
					lineHasNonSpace = false;
				}
			}
		}

		// Match the opening tag.
		if (!scanner.scan(openingTagRe)) {
			break;
		}

		hasTag = true;

		// Get the tag type.
		type = scanner.scan(tagRe) || 'name';
		scanner.scan(whiteRe);

		// Get the tag value.
		if (type === '=') {
			value = scanner.scanUntil(equalsRe);
			scanner.scan(equalsRe);
			scanner.scanUntil(closingTagRe);
		} else if (type === '{') {
			value = scanner.scanUntil(closingCurlyRe);
			scanner.scan(curlyRe);
			scanner.scanUntil(closingTagRe);
			type = '&';
		} else {
			value = scanner.scanUntil(closingTagRe);
		}

		// Match the closing tag.
		if (!scanner.scan(closingTagRe)) {
			throw new Error('Unclosed tag at ' + scanner.pos);
		}

		token = type == '>' ? [type, value, start, scanner.pos, indentation, tagIndex, lineHasNonSpace] : [type, value, start, scanner.pos];

		tagIndex++;
		tokens.push(token);

		switch (type) {
			case '#':
			case '^': {
				sections.push(token);

				break;
			}

			case '/': {
			// Check section nesting.
				openSection = sections.pop();

				if (!openSection) {
					throw new Error('Unopened section "' + value + '" at ' + start);
				}

				if (openSection[1] !== value) {
					throw new Error('Unclosed section "' + openSection[1] + '" at ' + start);
				}

				break;
			}

			case 'name':
			case '{':
			case '&': {
				nonSpace = true;

				break;
			}

			case '=': {
			// Set the tags for the next time around.
				compileTags(value);

				break;
			}
		// No default
		}
	}

	stripSpace();

	// Make sure there are no open sections when we're done.
	openSection = sections.pop();

	if (openSection) {
		throw new Error('Unclosed section "' + openSection[1] + '" at ' + scanner.pos);
	}

	return nestTokens(squashTokens(tokens));
}

/**
 * Combines the values of consecutive text tokens in the given `tokens` array
 * to a single token.
 */
function squashTokens(tokens) {
	const squashedTokens = [];

	let token; let lastToken;
	for (let index = 0, numberTokens = tokens.length; index < numberTokens; ++index) {
		token = tokens[index];

		if (token) {
			if (token[0] === 'text' && lastToken && lastToken[0] === 'text') {
				lastToken[1] += token[1];
				lastToken[3] = token[3];
			} else {
				squashedTokens.push(token);
				lastToken = token;
			}
		}
	}

	return squashedTokens;
}

/**
 * Forms the given array of `tokens` into a nested tree structure where
 * tokens that represent a section have two additional items: 1) an array of
 * all tokens that appear in that section and 2) the index in the original
 * template that represents the end of that section.
 */
function nestTokens(tokens) {
	const nestedTokens = [];
	let collector = nestedTokens;
	const sections = [];

	let token; let section;
	for (let index = 0, numberTokens = tokens.length; index < numberTokens; ++index) {
		token = tokens[index];

		switch (token[0]) {
			case '#':
			case '^':
				collector.push(token);
				sections.push(token);
				collector = token[4] = [];
				break;
			case '/':
				section = sections.pop();
				section[5] = token[2];
				collector = sections.length > 0 ? sections[sections.length - 1][4] : nestedTokens;
				break;
			default:
				collector.push(token);
		}
	}

	return nestedTokens;
}

/**
 * A simple string scanner that is used by the template parser to find
 * tokens in template strings.
 */
function Scanner(string) {
	this.string = string;
	this.tail = string;
	this.pos = 0;
}

/**
 * Returns `true` if the tail is empty (end of string).
 */
Scanner.prototype.eos = function eos() {
	return this.tail === '';
};

/**
 * Tries to match the given regular expression at the current position.
 * Returns the matched text if it can match, the empty string otherwise.
 */
Scanner.prototype.scan = function scan(re) {
	const match = this.tail.match(re);

	if (!match || match.index !== 0) {
		return '';
	}

	const string = match[0];

	this.tail = this.tail.slice(string.length);
	this.pos += string.length;

	return string;
};

/**
 * Skips all text until the given regular expression can be matched. Returns
 * the skipped string, which is the entire tail if no match can be made.
 */
Scanner.prototype.scanUntil = function scanUntil(re) {
	const index = this.tail.search(re); let
		match;

	switch (index) {
		case -1:
			match = this.tail;
			this.tail = '';
			break;
		case 0:
			match = '';
			break;
		default:
			match = this.tail.slice(0, Math.max(0, index));
			this.tail = this.tail.slice(Math.max(0, index));
	}

	this.pos += match.length;

	return match;
};

/**
 * Represents a rendering context by wrapping a view object and
 * maintaining a reference to the parent context.
 */
function Context(view, parentContext) {
	this.view = view;
	this.cache = {'.': this.view};
	this.parent = parentContext;
}

/**
 * Creates a new context using the given view with this context
 * as the parent.
 */
Context.prototype.push = function push(view) {
	return new Context(view, this);
};

/**
 * Returns the value of the given name in this context, traversing
 * up the context hierarchy if the value is absent in this context's view.
 */
Context.prototype.lookup = function lookup(name) {
	const cache = this.cache;

	let value;
	if (cache.hasOwnProperty(name)) {
		value = cache[name];
	} else {
		let context = this; let intermediateValue; let names; let index; let
			lookupHit = false;

		while (context) {
			if (name.indexOf('.') > 0) {
				intermediateValue = context.view;
				names = name.split('.');
				index = 0;

				/**
         * Using the dot notion path in `name`, we descend through the
         * nested objects.
         *
         * To be certain that the lookup has been successful, we have to
         * check if the last object in the path actually has the property
         * we are looking for. We store the result in `lookupHit`.
         *
         * This is specially necessary for when the value has been set to
         * `undefined` and we want to avoid looking up parent contexts.
         *
         * In the case where dot notation is used, we consider the lookup
         * to be successful even if the last "object" in the path is
         * not actually an object but a primitive (e.g., a string, or an
         * integer), because it is sometimes useful to access a property
         * of an autoboxed primitive, such as the length of a string.
         **/
				while (intermediateValue != null && index < names.length) {
					if (index === names.length - 1) {
						lookupHit = (
							hasProperty(intermediateValue, names[index])
              || primitiveHasOwnProperty(intermediateValue, names[index])
						);
					}

					intermediateValue = intermediateValue[names[index++]];
				}
			} else {
				intermediateValue = context.view[name];

				/**
         * Only checking against `hasProperty`, which always returns `false` if
         * `context.view` is not an object. Deliberately omitting the check
         * against `primitiveHasOwnProperty` if dot notation is not used.
         *
         * Consider this example:
         * ```
         * Mustache.render("The length of a football field is {{#length}}{{length}}{{/length}}.", {length: "100 yards"})
         * ```
         *
         * If we were to check also against `primitiveHasOwnProperty`, as we do
         * in the dot notation case, then render call would return:
         *
         * "The length of a football field is 9."
         *
         * rather than the expected:
         *
         * "The length of a football field is 100 yards."
         **/
				lookupHit = hasProperty(context.view, name);
			}

			if (lookupHit) {
				value = intermediateValue;
				break;
			}

			context = context.parent;
		}

		cache[name] = value;
	}

	if (isFunction(value)) {
		value = value.call(this.view);
	}

	return value;
};

/**
 * A Writer knows how to take a stream of tokens and render them to a
 * string, given a context. It also maintains a cache of templates to
 * avoid the need to parse the same template twice.
 */
function Writer() {
	this.templateCache = {
		_cache: {},
		set: function set(key, value) {
			this._cache[key] = value;
		},
		get: function get(key) {
			return this._cache[key];
		},
		clear: function clear() {
			this._cache = {};
		},
	};
}

/**
 * Clears all cached templates in this writer.
 */
Writer.prototype.clearCache = function clearCache() {
	if (typeof this.templateCache !== 'undefined') {
		this.templateCache.clear();
	}
};

/**
 * Parses and caches the given `template` according to the given `tags` or
 * `mustache.tags` if `tags` is omitted,  and returns the array of tokens
 * that is generated from the parse.
 */
Writer.prototype.parse = function parse(template, tags) {
	const cache = this.templateCache;
	const cacheKey = template + ':' + (tags || mustache.tags).join(':');
	const isCacheEnabled = typeof cache !== 'undefined';
	let tokens = isCacheEnabled ? cache.get(cacheKey) : undefined;

	if (tokens == undefined) {
		tokens = parseTemplate(template, tags);
		isCacheEnabled && cache.set(cacheKey, tokens);
	}

	return tokens;
};

/**
 * High-level method that is used to render the given `template` with
 * the given `view`.
 *
 * The optional `partials` argument may be an object that contains the
 * names and templates of partials that are used in the template. It may
 * also be a function that is used to load partial templates on the fly
 * that takes a single argument: the name of the partial.
 *
 * If the optional `tags` argument is given here it must be an array with two
 * string values: the opening and closing tags used in the template (e.g.
 * [ "<%", "%>" ]). The default is to mustache.tags.
 */
Writer.prototype.render = function render(template, view, partials, tags) {
	const tokens = this.parse(template, tags);
	const context = (view instanceof Context) ? view : new Context(view, undefined);
	return this.renderTokens(tokens, context, partials, template, tags);
};

/**
 * Low-level method that renders the given array of `tokens` using
 * the given `context` and `partials`.
 *
 * Note: The `originalTemplate` is only ever used to extract the portion
 * of the original template that was contained in a higher-order section.
 * If the template doesn't use higher-order sections, this argument may
 * be omitted.
 */
Writer.prototype.renderTokens = function renderTokens(tokens, context, partials, originalTemplate, tags) {
	let buffer = '';

	let token; let symbol; let value;
	for (let index = 0, numberTokens = tokens.length; index < numberTokens; ++index) {
		value = undefined;
		token = tokens[index];
		symbol = token[0];

		switch (symbol) {
			case '#': {value = this.renderSection(token, context, partials, originalTemplate);
				break;
			}

			case '^': {value = this.renderInverted(token, context, partials, originalTemplate);
				break;
			}

			case '>': {value = this.renderPartial(token, context, partials, tags);
				break;
			}

			case '&': {value = this.unescapedValue(token, context);
				break;
			}

			case 'name': {value = this.escapedValue(token, context);
				break;
			}

			case 'text': {value = this.rawValue(token);
				break;
			}
		// No default
		}

		if (value !== undefined) {
			buffer += value;
		}
	}

	return buffer;
};

Writer.prototype.renderSection = function renderSection(token, context, partials, originalTemplate) {
	const self = this;
	let buffer = '';
	let value = context.lookup(token[1]);

	// This function is used to render an arbitrary template
	// in the current context by higher-order sections.
	function subRender(template) {
		return self.render(template, context, partials);
	}

	if (!value) {
		return;
	}

	if (isArray(value)) {
		for (let index = 0, valueLength = value.length; index < valueLength; ++index) {
			buffer += this.renderTokens(token[4], context.push(value[index]), partials, originalTemplate);
		}
	} else if (typeof value === 'object' || typeof value === 'string' || typeof value === 'number') {
		buffer += this.renderTokens(token[4], context.push(value), partials, originalTemplate);
	} else if (isFunction(value)) {
		if (typeof originalTemplate !== 'string') {
			throw new TypeError('Cannot use higher-order sections without the original template');
		}

		// Extract the portion of the original template that the section contains.
		value = value.call(context.view, originalTemplate.slice(token[3], token[5]), subRender);

		if (value != null) {
			buffer += value;
		}
	} else {
		buffer += this.renderTokens(token[4], context, partials, originalTemplate);
	}

	return buffer;
};

Writer.prototype.renderInverted = function renderInverted(token, context, partials, originalTemplate) {
	const value = context.lookup(token[1]);

	// Use JavaScript's definition of falsy. Include empty arrays.
	// See https://github.com/janl/mustache.js/issues/186
	if (!value || (isArray(value) && value.length === 0)) {
		return this.renderTokens(token[4], context, partials, originalTemplate);
	}
};

Writer.prototype.indentPartial = function indentPartial(partial, indentation, lineHasNonSpace) {
	const filteredIndentation = indentation.replace(/[^ \t]/g, '');
	const partialByNl = partial.split('\n');
	for (let index = 0; index < partialByNl.length; index++) {
		if (partialByNl[index].length > 0 && (index > 0 || !lineHasNonSpace)) {
			partialByNl[index] = filteredIndentation + partialByNl[index];
		}
	}

	return partialByNl.join('\n');
};

Writer.prototype.renderPartial = function renderPartial(token, context, partials, tags) {
	if (!partials) {
		return;
	}

	const value = isFunction(partials) ? partials(token[1]) : partials[token[1]];
	if (value != null) {
		const lineHasNonSpace = token[6];
		const tagIndex = token[5];
		const indentation = token[4];
		let indentedValue = value;
		if (tagIndex == 0 && indentation) {
			indentedValue = this.indentPartial(value, indentation, lineHasNonSpace);
		}

		return this.renderTokens(this.parse(indentedValue, tags), context, partials, indentedValue, tags);
	}
};

Writer.prototype.unescapedValue = function unescapedValue(token, context) {
	const value = context.lookup(token[1]);
	if (value != null) {
		return value;
	}
};

Writer.prototype.escapedValue = function escapedValue(token, context) {
	const value = context.lookup(token[1]);
	if (value != null) {
		return mustache.escape(value);
	}
};

Writer.prototype.rawValue = function rawValue(token) {
	return token[1];
};

var mustache = {
	name: 'mustache.js',
	version: '4.0.1',
	tags: ['{{', '}}'],
	clearCache: undefined,
	escape: undefined,
	parse: undefined,
	render: undefined,
	Scanner: undefined,
	Context: undefined,
	Writer: undefined,
	/**
   * Allows a user to override the default caching strategy, by providing an
   * object with set, get and clear methods. This can also be used to disable
   * the cache by setting it to the literal `undefined`.
   */
	set templateCache(cache) {
		defaultWriter.templateCache = cache;
	},
	/**
   * Gets the default or overridden caching object from the default writer.
   */
	get templateCache() {
		return defaultWriter.templateCache;
	},
};

// All high-level mustache.* functions use this writer.
var defaultWriter = new Writer();

/**
 * Clears all cached templates in the default writer.
 */
mustache.clearCache = function clearCache() {
	return defaultWriter.clearCache();
};

/**
 * Parses and caches the given template in the default writer and returns the
 * array of tokens it contains. Doing this ahead of time avoids the need to
 * parse templates on the fly as they are rendered.
 */
mustache.parse = function parse(template, tags) {
	return defaultWriter.parse(template, tags);
};

/**
 * Renders the `template` with the given `view` and `partials` using the
 * default writer. If the optional `tags` argument is given here it must be an
 * array with two string values: the opening and closing tags used in the
 * template (e.g. [ "<%", "%>" ]). The default is to mustache.tags.
 */
mustache.render = function render(template, view, partials, tags) {
	if (typeof template !== 'string') {
		throw new TypeError('Invalid template! Template should be a "string" '
                        + 'but "' + typeString(template) + '" was given as the first '
                        + 'argument for mustache#render(template, view, partials)');
	}

	return defaultWriter.render(template, view, partials, tags);
};

// Export the escaping function so that the user may override it.
// See https://github.com/janl/mustache.js/issues/244
mustache.escape = escapeHtml;

// Export these mainly for testing, but also for advanced usage.
mustache.Scanner = Scanner;
mustache.Context = Context;
mustache.Writer = Writer;

export default mustache;
