class SchemaPiece {

	constructor(client, manager, options, path, key) {
		/**
		 * The Klasa client.
		 * @type {KlasaClient}
		 */
		Object.defineProperty(this, 'client', { value: client, enumerable: false });

		/**
		 * The Gateway that manages this SchemaPiece instance.
		 * @type {(Gateway|GatewaySQL)}
		 */
		Object.defineProperty(this, 'manager', { value: manager, enumerable: false });

		/**
		 * The path of this SchemaPiece instance.
		 * @type {string}
		 */
		Object.defineProperty(this, 'path', { value: path, enumerable: false });

		/**
		 * This keys' name.
		 * @type {string}
		 */
		Object.defineProperty(this, 'key', { value: key, enumerable: false });

		/**
		 * The type of this key.
		 * @type {string}
		 */
		this.type = options.type.toLowerCase();

		/**
		 * Whether this key should store multiple or a single value.
		 * @type {boolean}
		 */
		this.array = typeof options.array !== 'undefined' ? options.array : false;

		/**
		 * What this key should provide by default.
		 * @type {any}
		 */
		this.default = typeof options.default !== 'undefined' ? options.default : this.type === 'boolean' ? false : null;

		/**
		 * The minimum value for this key.
		 * @type {?number}
		 */
		this.min = typeof options.min !== 'undefined' && isNaN(options.min) === false ? options.min : null;

		/**
		 * The maximum value for this key.
		 * @type {?number}
		 */
		this.max = typeof options.max !== 'undefined' && isNaN(options.max) === false ? options.max : null;

		/**
		 * Whether this key should be configureable by the config command. When type is any, this key defaults to false.
		 * @type {boolean}
		 */
		this.configurable = typeof options.configurable !== 'undefined' ? options.configurable : this.type !== 'any';

		this.init();
	}

	/**
	 * Parse a SQL query.
	 * @param {string} value The value to parse.
	 * @returns {string}
	 */
	sql(value = null) {
		if (value && value.id) value = value.id;
		return `'${this.path}' = ${this._parseSQLValue(value)}`;
	}

	_parseSQLValue(value) {
		const type = typeof value;
		if (type === 'boolean' || type === 'number' || value === null) return String(value);
		if (type === 'string') return `'${value.replace(/'/g, "''")}'`;
		if (type === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
		return '';
	}

	/**
	 * @typedef  {Object} ParsingResult
	 * @property {any} data The raw parsed data.
	 * @property {?string} sql The SQL-ready query for the SQL Gateway.
	 * @memberof SchemaPiece
	 */

	/**
	 * Parse a value in this key's resolver.
	 * @param {string} value The value to parse.
	 * @param {external:Guild} guild A Guild instance required for the resolver to work.
	 * @returns {Promise<ParsingResult>}
	 */
	async parse(value, guild) {
		const data = await this.manager.resolver[this.type](value, guild, this.key, { min: this.min, max: this.max });
		return { data, sql: this.manager.sql ? this.sql(data && data.id ? data.id : data) : null };
	}

	/**
	 * Get the defaults values for this key.
	 * @returns {ParsingResult}
	 */
	getDefault() {
		return { data: this.default, sql: this.manager.sql ? this.sql(this.default) : null };
	}

	/**
	 * @typedef  {Object} SchemaPieceJSON
	 * @property {string}  type The type for the key.
	 * @property {any}     default The default value for the key.
	 * @property {number}  min The min value for the key (String.length for String, value for number).
	 * @property {number}  max The max value for the key (String.length for String, value for number).
	 * @property {boolean} array Whether the key should be stored as Array or not.
	 * @property {boolean} configurable Whether the key should be configurable by the config command or not.
	 */

	/**
	 * Get this key's raw data in JSON.
	 * @returns {SchemaPieceJSON}
	 */
	toJSON() {
		return {
			type: this.type,
			array: this.array,
			default: this.default,
			min: this.min,
			max: this.max,
			configurable: this.configurable
		};
	}

	/**
	 * Check if the key is properly configured.
	 */
	init() {
		if (typeof this.type !== 'string') throw new TypeError(`[KEY] ${this.path} - Parameter type must be a string.`);
		if (typeof this.array !== 'boolean') throw new TypeError(`[KEY] ${this.path} - Parameter array must be a boolean.`);
		if (this.min !== null && typeof this.min !== 'number') throw new TypeError(`[KEY] ${this.path} - Parameter min must be a number or null.`);
		if (this.max !== null && typeof this.max !== 'number') throw new TypeError(`[KEY] ${this.path} - Parameter max must be a number or null.`);
		if (this.min !== null && this.max !== null && this.min > this.max) throw new TypeError(`[KEY] ${this.path} - Parameter min must contain a value lower than the parameter max.`);
		if (typeof this.configurable !== 'boolean') throw new TypeError(`[KEY] ${this.path} - Parameter configurable must be a boolean.`);

		const value = [this.key, (this.type === 'integer' || this.type === 'float' ? 'INTEGER' : 'TEXT') +
				(this.default !== null ? ` DEFAULT ${this._parseSQLValue(this.default)}` : '')];

		Object.defineProperty(this, 'sqlSchema', { value, enumerable: false });
	}

	getSQL(array = null) {
		if (array !== null) array.push(this.sqlSchema);
		return this.sqlSchema;
	}

	getKeys(array = null) {
		if (array !== null) array.push(this.path);
		return this.path;
	}

	toString(value) {
		if (typeof value === 'undefined') return `{SchemaPiece:${this.type}}`;
		if (value === null) return 'Not set';
		switch (this.type) {
			case 'user': return `@${value.username}`;
			case 'textchannel':
			case 'voicechannel':
			case 'channel': return `#${value.name}`;
			case 'role': return `@${value.name}`;
			case 'guild': return value.name;
			case 'command':
			case 'language': return value;
			default: return String(value);
		}
	}

}

module.exports = SchemaPiece;
