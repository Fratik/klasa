const SchemaPiece = require('./SchemaPiece');
const fs = require('fs-nextra');

/**
 * The schema class that stores (nested) folders and keys for SettingGateway usage. This class also implements multiple helpers.
 */
class Schema {

	/**
	 * @typedef  {Object} AddOptions
	 * @property {string}  type The type for the key.
	 * @property {any}     [default] The default value for the key.
	 * @property {number}  [min] The min value for the key (String.length for String, value for number).
	 * @property {number}  [max] The max value for the key (String.length for String, value for number).
	 * @property {boolean} [array] Whether the key should be stored as Array or not.
	 * @property {boolean} [configurable] Whether the key should be configurable by the config command or not.
	 * @memberof Schema
	 */

	/**
	 * @since 0.4.0
	 * @param {KlasaClient} client The client which initialized this instance.
	 * @param {(Gateway|GatewaySQL)} manager The Gateway that manages this schema instance.
	 * @param {AddOptions} object The object containing the properties for this schema instance.
	 * @param {string} path The path for this schema instance.
	 */
	constructor(client, manager, object, path) {
		/**
		 * The Klasa client.
		 * @since 0.4.0
		 * @type {KlasaClient}
		 * @name Schema#client
		 * @readonly
		 */
		Object.defineProperty(this, 'client', { value: client });

		/**
		 * The Gateway that manages this schema instance.
		 * @since 0.4.0
		 * @type {(Gateway|GatewaySQL)}
		 * @name Schema#manager
		 * @readonly
		 */
		Object.defineProperty(this, 'manager', { value: manager });

		/**
		 * The path of this schema instance.
		 * @since 0.4.0
		 * @type {string}
		 * @name Schema#path
		 * @readonly
		 */
		Object.defineProperty(this, 'path', { value: path });

		/**
		 * The type of this schema instance.
		 * @since 0.4.0
		 * @type {'Folder'}
		 * @name Schema#type
		 * @readonly
		 */
		Object.defineProperty(this, 'type', { value: 'Folder' });

		/**
		 * The default values for this schema instance and children.
		 * @since 0.4.0
		 * @type {Object}
		 * @name Schema#defaults
		 * @readonly
		 */
		Object.defineProperty(this, 'defaults', { value: {}, writable: true });

		/**
		 * A Set containing all keys' names which value is either a Schema or a SchemaPiece instance.
		 * @since 0.4.0
		 * @type {Set<string>}
		 * @name Schema#keys
		 * @readonly
		 */
		Object.defineProperty(this, 'keys', { value: new Set(), writable: true });

		/**
		 * A pre-processed array with all keys' names.
		 * @since 0.4.0
		 * @type {string[]}
		 * @name Schema#keyArray
		 * @readonly
		 */
		Object.defineProperty(this, 'keyArray', { value: [], writable: true });

		this._patch(object);
	}

	/**
	 * Create a new nested folder.
	 * @since 0.4.0
	 * @param {string} key The name's key for the folder.
	 * @param {Object} [object={}] An object containing all the Schema/SchemaPieces literals for this folder.
	 * @param {boolean} [force=true] Whether this function call should modify all entries from the database.
	 * @returns {Promise<Schema>}
	 */
	async addFolder(key, object = {}, force = true) {
		if (this.hasKey(key)) throw `The key ${key} already exists in the current schema.`;
		if (typeof this[key] !== 'undefined') throw `The key ${key} conflicts with a property of Schema.`;
		this.keys.add(key);
		this.keyArray.push(key);
		this[key] = new Schema(this.client, this.manager, object, `${this.path === '' ? '' : `${this.path}.`}${key}`);
		this.defaults[key] = this[key].defaults;
		await fs.outputJSONAtomic(this.manager.filePath, this.manager.schema.toJSON());

		if (force) await this.forceMany('add', this[key]);
		return this.manager.schema;
	}

	/**
	 * Remove a nested folder.
	 * @since 0.4.0
	 * @param {string} key The folder's name to remove.
	 * @param {boolean} [force=true] Whether this function call should modify all entries from the database.
	 * @returns {Promise<Schema>}
	 */
	async removeFolder(key, force = true) {
		if (this.hasKey(key) === false) throw new Error(`The key ${key} does not exist in the current schema.`);
		if (this[key].type !== 'Folder') throw new Error(`The key ${key} is not Folder type.`);
		const folder = this[key];
		this._removeKey(key);
		await fs.outputJSONAtomic(this.manager.filePath, this.manager.schema.toJSON());

		if (force) await this.forceMany('delete', folder);
		return this.manager.schema;
	}

	/**
	 * Check if the key exists in this folder.
	 * @since 0.4.0
	 * @param {string} key The key to check.
	 * @returns {boolean}
	 */
	hasKey(key) {
		return this.keys.has(key);
	}

	/**
	 * Add a new key to this folder.
	 * @since 0.4.0
	 * @param {string} key The name for the key.
	 * @param {AddOptions} [options=null] The key's options to apply.
	 * @param {boolean} [force=true] Whether this function call should modify all entries from the database.
	 * @returns {Promise<Schema>}
	 */
	async addKey(key, options = null, force = true) {
		if (this.hasKey(key)) throw `The key ${key} already exists in the current schema.`;
		if (typeof this[key] !== 'undefined') throw `The key ${key} conflicts with a property of Schema.`;
		if (options === null) throw 'You must pass an options argument to this method.';
		if (typeof options.type !== 'string') throw 'The option type is required and must be a string.';
		options.type = options.type.toLowerCase();
		if (this.client.settings.types.includes(options.type) === false) throw `The type ${options.type} is not supported.`;
		if (typeof options.min !== 'undefined' && isNaN(options.min)) throw 'The option min must be a number.';
		if (typeof options.max !== 'undefined' && isNaN(options.max)) throw 'The option max must be a number.';
		if (typeof options.array !== 'undefined' && typeof options.array !== 'boolean') throw 'The option array must be a boolean.';
		if (typeof options.configurable !== 'undefined' && typeof options.configurable !== 'boolean') throw 'The option configurable must be a boolean.';

		if (options.array === true) {
			if (typeof options.default === 'undefined') options.default = [];
			else if (Array.isArray(options.default) === false) throw 'The option default must be an array if the array option is set to true.';
		} else {
			if (typeof options.default === 'undefined') options.default = options.type === 'boolean' ? false : null;
			options.array = false;
		}
		this._addKey(key, options);
		await fs.outputJSONAtomic(this.manager.filePath, this.manager.schema.toJSON());

		if (force) await this.force('add', key, this[key]);
		return this.manager.schema;
	}

	/**
	 * Add a key to the instance.
	 * @since 0.4.0
	 * @param {string} key The name of the key.
	 * @param {AddOptions} options The options of the key.
	 * @private
	 */
	_addKey(key, options) {
		if (this.hasKey(key)) throw new Error(`The key '${key}' already exists.`);
		this.keys.add(key);
		this.keyArray.push(key);
		this.keyArray.sort((a, b) => a.localeCompare(b));
		this[key] = new SchemaPiece(this.client, this.manager, options, `${this.path === '' ? '' : `${this.path}.`}${key}`, key);
		this.defaults[key] = options.default;
	}

	/**
	 * Remove a key from this folder.
	 * @since 0.4.0
	 * @param {string} key The key's name to remove.
	 * @param {boolean} [force=true] Whether this function call should modify all entries from the database.
	 * @returns {Promise<Schema>}
	 */
	async removeKey(key, force = true) {
		if (this.hasKey(key) === false) throw `The key ${key} does not exist in the current schema.`;
		this._removeKey(key);
		await fs.outputJSONAtomic(this.manager.filePath, this.manager.schema.toJSON());

		if (force) await this.force('delete', key, this[key]);
		return this.manager.schema;
	}

	/**
	 * Remove a key from the instance.
	 * @since 0.4.0
	 * @param {string} key The name of the key.
	 * @private
	 */
	_removeKey(key) {
		const index = this.keyArray.indexOf(key);
		if (index === -1) throw new Error(`The key '${key}' does not exist.`);

		this.keys.delete(key);
		this.keyArray.splice(index, 1);
		delete this[key];
		delete this.defaults[key];
	}

	/**
	 * Modifies all entries from the database.
	 * @since 0.4.0
	 * @param {('add'|'edit'|'delete')} action The action to perform.
	 * @param {SchemaPiece} schemaPiece The SchemaPiece instance to handle.
	 * @returns {Promise<void>}
	 * @private
	 */
	force(action, schemaPiece) {
		if (!(schemaPiece instanceof SchemaPiece)) {
			throw new TypeError(`'schemaPiece' must be an instance of 'SchemaPiece'.`);
		}

		const values = this.manager.cache.getValues(this.manager.type);
		const path = schemaPiece.path.split('.');

		if (action === 'add' || action === 'edit') {
			const defValue = this.defaults[schemaPiece.key];
			for (let i = 0; i < values.length; i++) {
				let value = values[i];
				for (let j = 0; j < path.length - 1; j++) value = value[path[j]];
				value[path[path.length - 1]] = defValue;
			}
			return this.manager.provider.updateValue(this.manager.type, schemaPiece.path, defValue, this.manager.options.nice);
		}

		if (action === 'delete') {
			for (let i = 0; i < values.length; i++) {
				let value = values[i];
				for (let j = 0; j < path.length - 1; j++) value = value[path[j]];
				delete value[path[path.length - 1]];
			}
			return this.manager.provider.removeValue(this.manager.type, schemaPiece.path, this.manager.options.nice);
		}
		throw new TypeError(`Action must be either 'add' or 'delete'. Got: ${action}`);
	}

	/**
	 * Modifies all entries from the database with multiple keys.
	 * @param {('add'|'delete')} action The action to perform.
	 * @param {Schema} folder The key to update.
	 * @private
	 */
	forceMany(action, folder) {
		if (!(folder instanceof Schema)) {
			throw new TypeError(`'folder' must be an instance of 'Schema'.`);
		}
		throw new Error('UNIMPLEMENTED');
	}

	/**
	 * Get a list.
	 * @since 0.4.0
	 * @param {external:Message} msg The Message instance.
	 * @param {Object} object The settings to parse.
	 * @returns {string}
	 */
	getList(msg, object) {
		const array = [];
		const keys = this.configurableKeys;
		if (keys.length === 0) return '';

		const longest = keys.reduce((a, b) => a.length > b.length ? a : b).length;
		for (let i = 0; i < keys.length; i++) {
			array.push(`${keys[i].padEnd(longest)} :: ${this[keys[i]].resolveString(msg, object[keys[i]])}`);
		}

		return array.join('\n');
	}

	/**
	 * Method called in initialization to populate the instance with the keys from the schema.
	 * @since 0.4.0
	 * @param {Object} object The object to parse. Only called once per initialization.
	 * @private
	 */
	_patch(object) {
		for (const key of Object.keys(object)) {
			if (typeof object[key] !== 'object') continue;
			// Force retrocompatibility with SGv1's schema
			if (typeof object[key].type === 'undefined') object[key].type = 'Folder';
			if (object[key].type === 'Folder') {
				const folder = new Schema(this.client, this.manager, object[key], `${this.path === '' ? '' : `${this.path}.`}${key}`);
				this[key] = folder;
				this.defaults[key] = folder.defaults;
			} else {
				const piece = new SchemaPiece(this.client, this.manager, object[key], `${this.path === '' ? '' : `${this.path}.`}${key}`, key);
				this[key] = piece;
				this.defaults[key] = piece.default;
			}
			this.keys.add(key);
			this.keyArray.push(key);
		}
		this.keyArray.sort((a, b) => a.localeCompare(b));
	}

	/**
	 * @since 0.4.0
	 * @returns {string}
	 */
	resolveString() {
		return this.toString();
	}

	/**
	 * Get a JSON object with all the default values.
	 * @since 0.4.0
	 * @returns {Object}
	 */
	getDefaults() {
		const object = {};
		for (let i = 0; i < this.keyArray.length; i++) object[this.keyArray[i]] = this[this.keyArray[i]].getDefaults();
		return object;
	}

	/**
	 * Get all the SQL schemas from this schema's children.
	 * @since 0.4.0
	 * @param {string[]} [array=[]] The array to push.
	 * @returns {string[]}
	 */
	getSQL(array = []) {
		for (let i = 0; i < this.keyArray.length; i++) this[this.keyArray[i]].getSQL(array);
		return array;
	}

	/**
	 * Get all the pathes from this schema's children.
	 * @since 0.4.0
	 * @param {string[]} [array=[]] The array to push.
	 * @returns {string[]}
	 */
	getKeys(array = []) {
		for (let i = 0; i < this.keyArray.length; i++) this[this.keyArray[i]].getKeys(array);
		return array;
	}

	/**
	 * Get all the SchemaPieces instances from this schema's children. Used for GatewaySQL.
	 * @since 0.4.0
	 * @param {string[]} [array=[]] The array to push.
	 * @returns {string[]}
	 */
	getValues(array = []) {
		for (let i = 0; i < this.keyArray.length; i++) this[this.keyArray[i]].getValues(array);
		return array;
	}

	/**
	 * Get all configureable keys from this schema.
	 * @since 0.4.0
	 * @readonly
	 * @returns {string[]}
	 */
	get configurableKeys() {
		if (this.keyArray.length === 0) return [];
		return this.keyArray.filter(key => this[key].type === 'Folder' || this[key].configurable);
	}

	/**
	 * Get a JSON object containing all the objects from this schema's children.
	 * @since 0.4.0
	 * @returns {Object}
	 */
	toJSON() {
		return Object.assign({ type: 'Folder' }, ...this.keyArray.map(key => ({ [key]: this[key].toJSON() })));
	}

	/**
	 * @since 0.4.0
	 * @returns {string}
	 */
	toString() {
		return this.configurableKeys.length !== 0 ? '[ Folder' : '[ Empty Folder';
	}

}

module.exports = Schema;