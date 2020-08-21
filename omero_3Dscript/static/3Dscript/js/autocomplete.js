"use strict";

// already entered length u.a.
function getCompletions(text, caret) {
  var pr = new ParsingResult();
  try {
    var input = Preprocessor.getLineForCursor(text, caret - 1);
    console.debug("input for autocompletion: " + input);
    var interpreter = new Interpreter(input);
    interpreter.line(pr, input.length);
  } catch(err) {
    console.debug("error: " + err.message);
    // console.debug(JSON.stringify(err));
  }

  var alreadyEnteredLength = 0;
  var options = [];
  if(pr.autocompletion && pr.autocompletion.options) {
    options = pr.autocompletion.options;
    alreadyEnteredLength = input.length - pr.autocompletion.insertionPos;
  }
  console.debug("options = [" + options + "]");
  return {alreadyEnteredLength: alreadyEnteredLength, options: options, selectionStart: -1, selectionEnd: -1};
}

class MacroExtractor {

  constructor(textbuffer) {
    this.text = textbuffer;
  }

  parse() {
    this.scriptStart   = [];
    this.functionStart = [];
    this.functionEnd   = [];
    this.scripts = {};
    let nOpen = 0;
    let index = 0;
    while(index < this.text.length) {
      while(index < this.text.length && !regionMatches(this.text, index, "script", 0, "script".length)) {
        index++;
      }
      if(index == this.text.length)
        return;

      scriptStart.push(index);
      index++;

      while(index < this.text.length && !regionMatches(text, index, "function", 0, "function".length)) {
        index++;
      }
      if(index == this.text.length)
        throw ("Could not find keyword 'function' for script");

      let start = index;
      functionStart.push(start);

      index += "function".length;
      let fun = "";
      while(index < this.text.length && this.text.charAt(index) != '(')
        fun += (this.text.charAt(index++));
      if(index == this.text.length)
        throw ("Expected '(' after function name: " + fun);

      index++;

      while(index < this.text.length && this.text.charAt(index) != '{')
        index++;

      if(index == this.text.length)
        throw ("Could not find opening { for function " + fun);

      nOpen = 1;
      index++;

      while(index < this.text.length) {
        let ch = this.text.charAt(index);
        if(ch == '{')
          nOpen++;
        if(ch == '}')
          nOpen--;

        if(nOpen == 0)
          break;
        index++;
      }

      if(index == this.text.length)
        throw ("Could not find closing } for function " + fun);

      let stop = index;

      functionEnd.push(stop + 1);

      scripts[fun.trim()] = text.substring(start, stop + 1);

      index++;
    }
  }
}

class Preprocessor {

	static getLineForCursor(text, pos) {
		let me = new MacroExtractor(text);
		try {
			me.parse();
		} catch(err) {
			console.debug("error: " + err.message);
			console.debug("error: " + JSON.stringify(err));
		}

		for(let m = 0; m < me.scriptStart.length; m++) {
			let start = me.scriptStart[m];
			// macro starts beyond cursor pos: we are definitely not in the macro
			if(start > pos)
				break;

			// maybe the parser failed because the macro isn't finished yet;
			// then me.functionEnd might be smaller
			// treat this as inside a script
			if(m >= me.functionEnd.length || pos <= me.functionEnd[m])
				return null;
		}

		// if we are here, cursorpos is not inside a macro, return the actual line

		if(pos >= text.length)
			pos = text.length - 1;

		// find out the start pos of the current line
		let lineStart = 0;
		let lastLineWithoutDash = "";

		for(let p = 0; p <= pos; p++) {
			if(regionMatches(text, p, "\r\n", 0, 2)) {
				let line = text.substring(lineStart, p).trim();
				if(line.endsWith(":"))
					lastLineWithoutDash = line.substring(0, line.length - 1);
				lineStart = p + 2;
				p++;
			}
			else if(regionMatches(text, p, "\r", 0, 1)) {
				let line = text.substring(lineStart, p).trim();
				if(line.endsWith(":"))
					lastLineWithoutDash = line.substring(0, line.length - 1);
				lineStart = p + 1;
			}
			else if(regionMatches(text, p, "\n", 0, 1)) {
				let line = text.substring(lineStart, p).trim();
				if(line.endsWith(":"))
					lastLineWithoutDash = line.substring(0, line.length - 1);
				lineStart = p + 1;
			}
		}

		let line = Preprocessor.trimLeading(text.substring(lineStart, pos + 1));
		if(line.startsWith("//"))
			return null;

		if(line.trim().endsWith(":"))
			return null;

		if(line.startsWith("-")) {
			line = Preprocessor.trimLeading(line.substring(1));
			line = lastLineWithoutDash + " " + line;
		}
		return line;
	}

  static trimLeading(text) {
    let len = text.length;
    let st = 0;

    while((st < len) && (text.charAt(st) <= ' '))
      st++;
    return (st > 0) ? text.substring(st, len) : text;
  }
}

class NumberOrMacro {

  constructor(v = -1, functionName = null) {
    this.v = v;
    this.functionName = null;
    this.macro = null;
  }

	isMacro() {
		return this.functionName != null;
	}
}

class Autocompletion {
  constructor(options, insertionPos = -1) {
    this.options = options;
    this.insertionPos = insertionPos;
  }
}

const GeneralKeyword = {
  FROM_FRAME: "From frame",
  TO_FRAME: "to frame",
  AT_FRAME: "At frame",
  ROTATE: "rotate by",
  DEGREES: "degrees",
  AROUND: "around",
  TRANSLATE: "translate",
  BY: "by",
  ZOOM: "zoom by a factor of",
  RESET_TRANSFORM: "reset transformation",
  CHANGE: "change",
  CHANNEL: "channel",
  ALL_CHANNELS: "all channels'",
  FROM: "from",
  TO: "to",
  HORIZONTALLY: "horizontally",
  VERTICALLY: "vertically"
};

const Transition = {
  NONE: "(none)",
  LINEAR: "linear",
  EASE_IN_OUT: "ease-in-out",
  EASE_IN: "ease-in",
  EASE_OUT: "ease-out",
  EASE: "ease"
};

class Keyword {

  /*
   * keyword: String
   * autocompletionDesc: String[]
   * replacementMap: Map<String, double[]>
   */
  constructor(keyword, autocompletionDesc, replacementMap = {}) {
    this.keyword = keyword;
    this.autocompletionDescription = autocompletionDesc;
    this.replacementMap = replacementMap;
  }

  static makeColorMap() {
		return {
      red:     [255.0,   0.0,   0.0],
      green:   [  0.0, 255.0,   0.0],
      blue:    [  0.0,   0.0, 255.0],
      yellow:  [255.0, 255.0,   0.0],
      cyan:    [  0.0, 255.0, 255.0],
      magenta: [255.0,   0.0, 255.0],
      white:   [255.0, 255.0, 255.0],
    };
  }
  static makeOnOffMap() {
    return {
      on:  [1.0],
      off: [0.0],
    }
	}
  static makeRenderingAlgorithmMap() {
    var map = {};
    map["independent transparency"] = 0;
    map["combined transparency"]    = 1;
    map["maximum intensity"]        = 2;
    return map;
  }
  static makePositionMap() {
    var map = {};
    map["object - lower left front"]  = 0;
    map["object - lower right front"] = 1;
    map["object - upper left front"]  = 2;
    map["object - upper right front"] = 3;
    map["object - lower left back"]   = 4;
    map["object - lower right back"]  = 5;
    map["object - upper left back"]   = 6;
    map["object - upper right back"]  = 7;
    map["view - lower left"]          = 8;
    map["view - lower right"]         = 9;
    map["view - upper left"]          = 10;
    map["view - upper right"]         = 11;
    return map;
  }
}

const ChannelKeywords = {
  INTENSITY_MIN   : new Keyword("min intensity",   ["<min>"]),
  INTENSITY_MAX   : new Keyword("max intensity",   ["<max>"]),
  INTENSITY_GAMMA : new Keyword("intensity gamma", ["<gamma>"]),

  ALPHA_MIN   : new Keyword("min alpha",   ["<min>"]),
  ALPHA_MAX   : new Keyword("max alpha",   ["<max>"]),
  ALPHA_GAMMA : new Keyword("alpha gamma", ["<gamma>"]),

  INTENSITY : new Keyword("intensity", ["<min>", "<max>", "<gamma>"]),
  ALPHA     : new Keyword("alpha",     ["<min>", "<max>", "<gamma>"]),

  COLOR  : new Keyword("color",  ["<red>", "<green>", "<blue>"], Keyword.makeColorMap()),
  WEIGHT : new Keyword("weight", ["<weight>"]),

  USE_LIGHT             : new Keyword("lighting",       ["<on/off>"], Keyword.makeOnOffMap()),
  OBJECT_LIGHT_WEIGHT   : new Keyword("object light",   ["<weight>"]),
  DIFFUSE_LIGHT_WEIGHT  : new Keyword("diffuse light",  ["<weight>"]),
  SPECULAR_LIGHT_WEIGHT : new Keyword("specular light", ["<weight>"]),
  SHININESS             : new Keyword("shininess",      ["<shininess>"]),
  LIGHT                 : new Keyword("light",          ["<object>", "<diffuse>", "<specular>", "<shininess>"]),

  BOUNDING_BOX_X_MIN : new Keyword("bounding box min x", ["<x>"]),
  BOUNDING_BOX_Y_MIN : new Keyword("bounding box min y", ["<y>"]),
  BOUNDING_BOX_Z_MIN : new Keyword("bounding box min z", ["<z>"]),
  BOUNDING_BOX_X_MAX : new Keyword("bounding box max x", ["<x>"]),
  BOUNDING_BOX_Y_MAX : new Keyword("bounding box max y", ["<y>"]),
  BOUNDING_BOX_Z_MAX : new Keyword("bounding box max z", ["<z>"]),

  BOUNDING_BOX_X : new Keyword("bounding box x", ["<xmin>", "<xmax>"]),
  BOUNDING_BOX_Y : new Keyword("bounding box y", ["<ymin>", "<ymax>"]),
  BOUNDING_BOX_Z : new Keyword("bounding box z", ["<zmin>", "<zmax>"]),

  FRONT_CLIPPING : new Keyword("front clipping", ["<front>"]),
  BACK_CLIPPING  : new Keyword("back clipping",  ["<back>"]),

  FRONT_BACK_CLIPPING : new Keyword("front/back clipping", ["<front>", "<back>"])
};

const NonChannelKeywords = {
  BG_COLOR            : new Keyword("background color",    ["<red>", "<green>", "<blue>"], Keyword.makeColorMap()),
  TIMEPOINT           : new Keyword("timepoint",           ["<timepoint>"]),
  RENDERING_ALGORITHM : new Keyword("rendering algorithm", ["<algorithm>"], Keyword.makeRenderingAlgorithmMap()),
	SCALEBAR_VISIBILITY : new Keyword("scalebar visibility", ["<on/off>"], Keyword.makeOnOffMap()),
	SCALEBAR_LENGTH     : new Keyword("scalebar length",     ["<length>"]),
	SCALEBAR_COLOR      : new Keyword("scalebar color",      ["<red>", "<green>", "<blue>"], Keyword.makeColorMap()),
	SCALEBAR_WIDTH      : new Keyword("scalebar width",      ["<width>"]),
	SCALEBAR_POSITION   : new Keyword("scalebar position",   ["<position>"], Keyword.makePositionMap()),
	SCALEBAR_OFFSET     : new Keyword("scalebar offset",     ["<offset>"]),
	BOUNDINGBOX_VISIBILITY : new Keyword("bounding box visibility", ["<on/off>"], Keyword.makeOnOffMap()),
	BOUNDINGBOX_COLOR   : new Keyword("bounding box color", ["<red>", "<green>", "<blue>"], Keyword.makeColorMap()),
	BOUNDINGBOX_WIDTH   : new Keyword("bounding box width", ["<width>"])
};

function keywordNames(keywords) {
  return Object.values(keywords).map(function(kw) {return kw.keyword;});
}
 


const TokenType = {
  DIGIT: 'digit',
  DOT: 'dot',
  SIGN: 'sign',
  LPAREN: 'lparen',
  RPAREN: 'rparen',
  COMMA: 'comma',
  KEYWORD: 'keyword',
  SPACE: 'space',
  LETTER: 'letter',
  UNDERSCORE: 'underscore',
  EOF: 'eof'
};

class Token {
  constructor(text, type, offset) {
    this.text = text;
    this.type = type;
    this.offset = offset;
  }

  length() {
    return this.text.length;
  }
}

class Lexer {
  constructor(input) {
    this.input = input;
    this.index = 0;
  }

  getNextTokenFromStrings(tokens, optional) {
		for(const token of tokens) {
			if(regionMatches(this.input, this.index, token, 0, token.length)) {
				var pos = this.index;
				this.index += token.length;
				return new Token(token, TokenType.KEYWORD, pos);
			}
		}
		if(optional)
			return null; // without increasing index;
		throw ("Error at position " + this.index + ": Expected one of [" + tokens.join() + "] but found end of line.");
	}  

  getNextTokenFromKeyword(keyword, optional) {
		if(regionMatches(this.input, this.index, keyword, 0, keyword.length)) {
			var pos = this.index;
			this.index += keyword.length;
			return new Token(keyword, TokenType.KEYWORD, pos);
		}
		if(optional)
			return null; // without increasing index;
		throw ("Error at position " + this.index + ": Expected " + keyword + " but found end of line.");
	}

  getNextTokenFromType(tokenType, optional) {
		if(this.index >= this.input.length) {
			if(tokenType == TokenType.EOF)
				return new Token("", TokenType.EOF, this.index);
			if(optional)
				return null; // without increasing index;
			throw ("Error at position " + this.index + ": Expected " + tokenType + " but found end of line.");
		}

		const c = this.input.charAt(this.index);
		if(tokenType == TokenType.DIGIT) {
			if(c >= '0' && c <= '9')
				return new Token("" + c, tokenType, this.index++);
			if(optional)
				return null; // without increasing index;
			throw ("Error at position " + this.index + ": Expected " + tokenType + " but found " + c);
		}

		else if(tokenType == TokenType.LETTER) {
			if((c >= 'a' && c <= '9') || (c >= 'A' && c <= 'Z'))
				return new Token("" + c, tokenType, this.index++);
			if(optional)
				return null; // without increasing index;
			throw ("Error at position " + this.index + ": Expected " + tokenType + " but found " + c);
		}

		else if(tokenType == TokenType.UNDERSCORE) {
			if(c == '_')
				return new Token("_", tokenType, this.index++);
			if(optional)
				return null; // without increasing index;
			throw ("Error at position " + this.index + ": Expected " + tokenType + " but found " + c);
		}

		else if(tokenType == TokenType.SPACE) {
			if(c == ' ')
				return new Token(' ', TokenType.SPACE, this.index++);
			if(optional)
				return null; // without increasing index;
			throw ("Error at position " + this.index + ": Expected " + tokenType + " but found " + c);
		}

		else if(tokenType == TokenType.DOT) {
			if(c == '.')
				return new Token('.', TokenType.DOT, this.index++);
			if(optional)
				return null; // without increasing index;
			throw ("Error at position " + this.index + ": Expected " + tokenType + " but found " + c);
		}

		else if(tokenType == TokenType.SIGN) {
			if(c == '+' || c == '-')
				return new Token("" + c, TokenType.SIGN, this.index++);
			if(optional)
				return null; // without increasing index;
			throw ("Error at position " + this.index + ": Expected " + tokenType + " but found " + c);
		}

		else if(tokenType == TokenType.LPAREN) {
			if(c == '(')
				return new Token("" + c, TokenType.LPAREN, this.index++);
			if(optional)
				return null; // without increasing index;
			throw ("Error at position " + this.index + ": Expected " + tokenType + " but found " + c);
		}

		else if(tokenType == TokenType.RPAREN) {
			if(c == ')')
				return new Token(")", TokenType.RPAREN, this.index++);
			if(optional)
				return null; // without increasing index;
			throw ("Error at position " + this.index + ": Expected " + tokenType + " but found " + c);
		}

		else if(tokenType == TokenType.COMMA) {
			if(c == ',')
				return new Token(",", TokenType.COMMA, this.index++);
			if(optional)
				return null; // without increasing index;
			throw ("Error at position " + this.index + ": Expected " + tokenType + " but found " + c);
		}

		else if(tokenType == TokenType.KEYWORD) {
			throw ("Should not call getToken() with TokenType==KEYWORD");
		}

		else {
			throw new RuntimeException("Unknow token type: " + tokenType);
		}
	}

  getAutocompletionListFromStrings(cursorpos, keywords) {
		const prefix = this.input.substring(this.index, cursorpos);
		var returnlist = [];
		for(const kw of keywords)
			if(regionMatches(kw, 0, prefix, 0, prefix.length))
				returnlist.push(kw);
    return new Autocompletion(returnlist, this.index);
	}

  getAutocompletionListFromKeywords(cursorpos, keywords) {
		const prefix = this.input.substring(this.index, cursorpos);
		var returnlist = [];
		for(const kw of keywords)
			if(regionMatches(kw.keyword, 0, prefix, 0, prefix.length))
				returnlist.push(kw.keyword);
    return new Autocompletion(returnlist, this.index);
	}

  getAutocompletionString(cursorpos, kw) {
		const prefix = this.input.substring(this.index, cursorpos);
		if(regionMatches(kw.getKeyword(), 0, prefix, 0, prefix.length))
			return kw.getKeyword();
		return null;
	}
}

class Interpreter {
  constructor(text) {
    this.lexer = new Lexer(text);
  }

  skipSpace() {
		while(this.lexer.getNextTokenFromType(TokenType.SPACE, true) != null)
			;
	}  

  letter(optional) {
		return this.lexer.getNextTokenFromType(TokenType.LETTER, optional);
	}

  underscore(optional) {
		return this.lexer.getNextTokenFromType(TokenType.UNDERSCORE, optional);
	}

  sign(optional) {
		this.skipSpace();
		return this.lexer.getNextTokenFromType(TokenType.SIGN, optional);
	}

  digit(optional) {
		return this.lexer.getNextTokenFromType(TokenType.DIGIT, optional);
	}

	dot(optional) {
		return this.lexer.getNextTokenFromType(TokenType.DOT, optional);
	}

	lparen(optional) {
		this.skipSpace();
		return this.lexer.getNextTokenFromType(TokenType.LPAREN, optional);
	}

	rparen(optional) {
		this.skipSpace();
		return this.lexer.getNextTokenFromType(TokenType.RPAREN, optional);
	}

	comma(optional) {
		this.skipSpace();
		return this.lexer.getNextTokenFromType(TokenType.COMMA, optional);
	}

  keyword(kw, optional) {
		this.skipSpace();
		return this.lexer.getNextTokenFromKeyword(kw, optional);
	}

	space(parsingResult) {
    parsingResult.setAutocompletion(new Autocompletion([], this.lexer.index));
		return this.lexer.getNextTokenFromType(TokenType.SPACE, false);
	}

  /**
	 * integer :: S?D+
	 */
	integer() {
		var buffer = [];
		var token;
		if((token = this.sign(true)) != null)
			buffer.push(token.text);

		buffer.push(this.digit(false).text);
		while((token = this.digit(true)) != null)
			buffer.push(token.text);
		return parseInt(buffer.join(""));
	}

 	/**
	 * real :: S?D+(.D*)?
	 *    D :: (0|1|2|3|4|5|6|7|8|9)
	 *    S :: (+|-)
	 */
	real() {
		var buffer = [];
		var token;
		if((token = this.sign(true)) != null)
			buffer.push(token.text);

		buffer.push(this.digit(false).text);
		while((token = this.digit(true)) != null)
			buffer.push(token.text);

		if((token = this.dot(true)) != null) {
			buffer.push(token.text);

			while((token = this.digit(true)) != null)
				buffer.push(token.text);
		}
		return parseFloat(buffer.join(""));
	}

  /**
	 * mor :: (macro | real)
	 * @return
	 */
	mor() {
		const functionName = this.macro();
		if(functionName != null)
			return new NumberOrMacro(-1, functionName);
		const v = this.real();
		return new NumberOrMacro(v);
	}

  /**
	 * macro :: (L|_)(L|_|D)*
	 *    L :: (a-z|A-Z)
	 *    D :: (0|1|2|3|4|5|6|7|8|9)
	 */
	macro() {
		var buffer = [];
		var token;
		if((token = this.letter(true)) != null)
			buffer.push(token.text);
		else if((token = this.underscore(true)) != null)
			buffer.push(token.text);
		else
			return null;

		while(true) {
			if((token = this.letter(true)) != null)
				buffer.push(token.text);
			else if((token = this.underscore(true)) != null)
				buffer.push(token.text);
			else if((token = this.digit(true)) != null)
				buffer.push(token.text);
			else
				break;
		}
		var ret = buffer.join("");
    console.debug("macro: found " + ret);
    return ret;
	}

  /**
	 * tuple :: (real ,real)
   * return NumberOrMacro[]
	 */
	tuple() {
		this.lparen(false);

		this.skipSpace();
		const a = this.mor();
		this.skipSpace();
		this.comma(false);

		this.skipSpace();
		const b = this.mor();
		this.skipSpace();

		this.rparen(false);

		return [a, b];
	}

  /**
	 * triple :: (real ,real, real)
   * return NumberOrMacro[]
	 */
	triple() {
		this.lparen(false);

		this.skipSpace();
		const a = this.mor();
		this.skipSpace();
		this.comma(false);

		this.skipSpace();
		const b = this.mor();
		this.skipSpace();
		this.comma(false);

		this.skipSpace();
		const c = this.mor();
		this.skipSpace();
		this.rparen(false);

		return [a, b, c];
	}

  /**
	 * quadruple :: (real, real, real, real)
	 */
	quadruple() {
		this.lparen(false);

		this.skipSpace();
		const a = this.mor();
		this.skipSpace();
		this.comma(false);

		this.skipSpace();
		const b = this.mor();
		this.skipSpace();
		this.comma(false);

		this.skipSpace();
		const c = this.mor();
		this.skipSpace();
		this.comma(false);

		this.skipSpace();
		const d = this.mor();
		this.skipSpace();
		this.rparen(false);

		return [a, b, c, d];
	}

  /**
	 * rotation :: rotate by real degrees (horizontally | vertically | around triple)
   *
   * returns void
	 */
	rotation(parsingResult, cursorpos) {
		if(this.keyword(GeneralKeyword.ROTATE, true) == null)
			return false;

		this.space(parsingResult, false);

		parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, ["<degrees>"]));

		const degrees = this.mor();

		this.space(parsingResult, false);

		parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [GeneralKeyword.DEGREES]));
		this.keyword(GeneralKeyword.DEGREES, false);

		this.space(parsingResult, false);

		parsingResult.setAutocompletion(
				this.lexer.getAutocompletionListFromStrings(cursorpos, [
            GeneralKeyword.HORIZONTALLY,
						GeneralKeyword.VERTICALLY,
						GeneralKeyword.AROUND]));

		var axis = null;
		if(this.keyword(GeneralKeyword.HORIZONTALLY, true) != null) {
      ;
		}
		else if(this.keyword(GeneralKeyword.VERTICALLY, true) != null) {
      ;
    }
		else {
			this.keyword(GeneralKeyword.AROUND, false);
			this.space(parsingResult, false);
      parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, ["(<vx>, <vy>, <vz>)"]));
			this.triple();
		}
    return true;
	}

  resetTransform(parsingResult, cursorpos) {
		if(this.keyword(GeneralKeyword.RESET_TRANSFORM, true) == null)
			return false;

		return true;
	}

  /**
	 * translation :: translate (horizontally by X | vertically by Y | by TRIPLE)
	 */
	translation(parsingResult, cursorpos) {
		if(this.keyword(GeneralKeyword.TRANSLATE, true) == null)
			return false;

		this.space(parsingResult, false);

		parsingResult.setAutocompletion(
				this.lexer.getAutocompletionListFromStrings(cursorpos, [
            GeneralKeyword.HORIZONTALLY,
						GeneralKeyword.VERTICALLY,
						GeneralKeyword.BY + " (X, Y, Z)"]));

		var dx = [];

		if(this.keyword(GeneralKeyword.HORIZONTALLY, true) != null) {
			this.space(parsingResult, false);

      parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [GeneralKeyword.BY]));
			this.keyword(GeneralKeyword.BY, false);

			this.space(parsingResult, false);

      parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, ["<dx>"]));
			dx[0] = this.mor();
			dx[1] = new NumberOrMacro(0);
			dx[2] = new NumberOrMacro(0);
		}
		else if(this.keyword(GeneralKeyword.VERTICALLY, true) != null) {
			this.space(parsingResult, false);

      parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [GeneralKeyword.BY]));
			this.keyword(GeneralKeyword.BY, false);

			this.space(parsingResult, false);

      parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, ["<dy>"]));
			dx[0] = new NumberOrMacro(0);
			dx[1] = this.mor();
			dx[2] = new NumberOrMacro(0);
		}
		else {
			this.keyword(GeneralKeyword.BY, false);

			this.space(parsingResult, false);
      parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, ["(<dx>, <dy>, <dz>)"]));
			dx = this.triple(parsingResult);
		}

		return true;
	}

	/**
	 * zoom :: zoom by a factor of real
	 */
	zoom(parsingResult, cursorpos) {
		if(this.keyword(GeneralKeyword.ZOOM, true) == null)
			return false;
		this.space(parsingResult, false);
    parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, ["<zoom>"]));
		const factor = this.mor();
		return true;
	}


  /**
	 * channelproperty :: (color min | color max | color gamma | alpha min | alpha max | alpha gamma | weight | color | alpha)
	 */
	channelproperty(parsingResult, cursorpos) {
    var channelKeywords = Object.values(ChannelKeywords);
		parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromKeywords(cursorpos, channelKeywords));

		for(const cp of channelKeywords) {
			if(this.keyword(cp.keyword, true) != null) {
				return cp;
			}
		}
		throw ("Expected channel property");
	}

  /**
	 * nonchannelproperty :: (bounding box min x | bounding box max x | bounding box min y | bounding box max y |
	 *                        bounding box min z | bounding box max z | front clipping | back clipping |
	 *                        bounding box x | bounding box y | bounding box z)
	 */
	nonchannelproperty(parsingResult, cursorpos) {
		var nonChannelKeywords = Object.values(NonChannelKeywords);
		for(const cp of nonChannelKeywords) {
			if(this.keyword(cp.keyword, true) != null) {
				return cp;
			}
		}
		throw ("Expected non-channel property");
	}

	/**
	 *             change :: change (channel X channelproperty | renderingproperty) to (real | macro)
	 *    channelproperty :: (color min | color max | color gamma | alpha min | alpha max | alpha gamma | weight)
	 * nonchannelproperty :: (bounding box min x | bounding box max x | bounding box min y | bounding box max y |
	 *                        bounding box min z | bounding box max z | front clipping | back clipping)
	 */
	change(parsingResult, cursorpos) {
		if(this.keyword(GeneralKeyword.CHANGE, true) == null)
			return false;

		this.space(parsingResult, false);

		var choice = [GeneralKeyword.CHANNEL, GeneralKeyword.ALL_CHANNELS].concat(keywordNames(NonChannelKeywords));
		parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, choice));

		// int[] timelineIdcs = null;
		var autocompletionDescriptions = null;
		var replacements = null;
		var channel = -1;
		if(this.keyword(GeneralKeyword.CHANNEL, true) != null) {
			this.space(parsingResult, false);
      parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, ["<channel>"]));
			channel = this.integer() - 1;
			this.space(parsingResult, false);
			var cp = this.channelproperty(parsingResult, cursorpos);
			// timelineIdcs = cp.getRenderingStateProperties();
			autocompletionDescriptions = cp.autocompletionDescription;
			replacements = cp.replacementMap;
		} else if(this.keyword(GeneralKeyword.ALL_CHANNELS, true) != null) {
			channel = 1000; // ChangeAnimation.ALL_CHANNELS;
			this.space(parsingResult, false);
			var cp = this.channelproperty(parsingResult, cursorpos);
			// timelineIdcs = cp.getRenderingStateProperties();
			autocompletionDescriptions = cp.autocompletionDescription;
			replacements = cp.replacementMap;
		}
		else {
			var cp = this.nonchannelproperty(parsingResult, cursorpos);
			// timelineIdcs = cp.getRenderingStateProperties();
			autocompletionDescriptions = cp.autocompletionDescription;
			replacements = cp.replacementMap;
		}

		if(replacements == null)
			replacements = {};

		this.space(parsingResult, false);
    parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [GeneralKeyword.TO]));
		this.keyword(GeneralKeyword.TO, false);

		this.space(parsingResult, false);

    var compl = Object.keys(replacements);

		switch(autocompletionDescriptions.length) {
		case 1:
			if(compl.length == 0)
        parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, autocompletionDescriptions));
			else {
        parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, autocompletionDescriptions.concat(compl)));
			}
			if(compl.length > 0) { // replacments available
				var token = this.lexer.getNextTokenFromStrings(compl, true);
				if(token == null) // not one of the replacement strings
					this.mor();
			} else {
				this.mor();
			}
			break;
		case 2:
      var tmp = "(" + autocompletionDescriptions[0] + ", " + autocompletionDescriptions[1] + ")";
			if(compl.length == 0)
        parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [tmp]));
			else {
        parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [tmp].concat(compl)));
			}
			if(compl.length > 0) { // replacments available
				var token = this.lexer.getNextTokenFromStrings(compl, true);
				if(token == null) // not one of the replacement strings
					this.tuple();
			} else {
				this.tuple();
			}
			break;
		case 3:
      var tmp = "(" + autocompletionDescriptions[0] + ", " + autocompletionDescriptions[1] + ", " + autocompletionDescriptions[2] + ")";
			if(compl.length == 0)
        parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [tmp]));
			else {
        parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [tmp].concat(compl)));
			}
			if(compl.length > 0) { // replacments available
				var token = this.lexer.getNextTokenFromStrings(compl, true);
				if(token == null) // not one of the replacement strings
					this.triple();
			} else {
				this.triple();
			}
			break;
		case 4:
      var tmp = "(" + autocompletionDescriptions[0] + ", " + autocompletionDescriptions[1] + ", " + autocompletionDescriptions[2] + ", " + autocompletionDescriptions[3] + ")";
			if(compl.length == 0)
        parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [tmp]));
			else {
        parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [tmp].concat(compl)));
			}
			if(compl.length > 0) { // replacments available
				var token = lexer.getNextTokenFromStrings(compl, true);
				if(token == null) // not one of the replacement strings
					this.quadruple();
			} else {
				quadruple();
			}
			break;
		}
		return true;
	}

	/**
	 * action :: (rotation | translation | zoom | change) (transition)?
	 * transition :: (linear | ease | ease-in | ease-out | ease-in-out)
	 *
	 * https://www.w3.org/TR/css3-transitions/#transition-timing-function
	 */
	action(from, to, parsingResult, cursorpos) {
		parsingResult.setAutocompletion(
				this.lexer.getAutocompletionListFromStrings(cursorpos, [
            GeneralKeyword.ROTATE,
            GeneralKeyword.TRANSLATE,
            GeneralKeyword.ZOOM,
            GeneralKeyword.RESET_TRANSFORM,
            GeneralKeyword.CHANGE]));

		var ta = this.rotation(parsingResult, cursorpos);
		if(!ta)
			ta = this.translation(parsingResult, cursorpos);
		if(!ta)
			ta = this.zoom(parsingResult, cursorpos);
    if(!ta)
      ta = this.resetTransform(parsingResult, cursorpos);
		if(!ta)
      ta = this.change(parsingResult, cursorpos);

		if(!ta)
			throw ("Expected rotation, translation, zoom or change for action");

		this.space(parsingResult, false);

		parsingResult.setAutocompletion(
        this.lexer.getAutocompletionListFromStrings(cursorpos, Object.values(Transition)));
	}

  /**
	 * line :: From frame integer to frame integer action
	 */
	line(parsingResult, cursorpos) {
		this.skipSpace();

		parsingResult.setAutocompletion(
						this.lexer.getAutocompletionListFromStrings(cursorpos, [
                GeneralKeyword.FROM_FRAME,
								GeneralKeyword.AT_FRAME]));

		var from = -1, to = -1;

		if(this.keyword(GeneralKeyword.AT_FRAME, true) != null) {
			this.space(parsingResult, false);
      parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, ["<frame>"]));
			from = to = this.integer();
		} else {
			this.keyword(GeneralKeyword.FROM_FRAME, false);

			this.space(parsingResult, false);
      parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, ["<frame>"]));
			from = this.integer();

			this.space(parsingResult, false);
			parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, [GeneralKeyword.TO_FRAME]));
			this.lexer.getNextTokenFromKeyword(GeneralKeyword.TO_FRAME, false);

			this.space(parsingResult, false);
      parsingResult.setAutocompletion(this.lexer.getAutocompletionListFromStrings(cursorpos, ["<frame>"]));
			to = this.integer();
		}

		this.space(parsingResult, false);

		this.action(from, to, parsingResult, cursorpos);
	}
}

function regionMatches(s1, i1, s2, i2, len) {
  if(i1 + len > s1.length || i2 + len > s2.length)
    return false;

  for(var i = 0; i < len; i++) {
    if(s1.charAt(i1++) != s2.charAt(i2++))
      return false;
  }
  return true;
}

class ParsingResult {
  setAutocompletion(comp) {
    this.autocompletion = comp;
  }
}

function test(input) {
  console.debug("input = "  + input);
  var interpreter = new Interpreter(input);
  var pr = new ParsingResult();
  try {
    interpreter.line(pr, input.length);
  } catch(err) {
    console.debug("error: " + err.message);
    console.debug(JSON.stringify(err));
  }

  var compl = "";
  if(pr.autocompletion && pr.autocompletion.options) {
    try {
      compl = pr.autocompletion.options.join(", ");
    } catch(err) {
      console.debug(pr.autocompletion);
      console.debug(err);
    }
  }
  console.debug("  completions: [" + compl + "]");
}

function testmain() {
  test("From frame 0 to frame 200 rotate by 360 degrees horizontally");
  test("From frame 0 to frame 200 ro");
  test("From frame 0 ");
  test("From frame 0 to frame 200 trans");
  test("From frame 0 to frame 200 translate ");
  test("From frame 0 to frame 200 translate by ");
  test("From frame 0 to frame 200 translate vertically by ");
  test("From frame 0 to frame 200 z");
  test("From frame 0 to frame 200 zoom by a factor of ");
  test("From frame 0 to frame 200 zoom by a factor af ");

  test("From frame ");
  test("From frame");
  test("From f");

  test("From frame 0 to frame 100 chang");
  test("From frame 0 to frame 100 change ");
  test("From frame 0 to frame 100 change b");
  test("From frame 0 to frame 100 change c");
  test("From frame 0 to frame 100 change channel ");
  test("From frame 0 to frame 100 change channel 1 ");
  test("From frame 0 to frame 100 change channel 1 min intensity ");
  test("From frame 0 to frame 100 change channel 1 min intensity to ");
  test("From frame 0 to frame 100 change channel 1 intensity to ");
  test("From frame 0 to frame 100 change channel 1 color to ");
  test("From frame 0 to frame 100 change rendering algorithm to ");
  test("From frame 0 to frame 100 change background color to ");
  test("From frame 0 to frame 100 change all channels' ");
  test("From frame 0 to frame 100 change all channels' front/back clipping to ");
}

