import path from "path";
import BS3 from "better-sqlite3";

export default class Storage {
	// represents a database
	private db: BS3.Database;
	readonly: boolean;
	constructor(file: string) {
		this.db = new BS3(path.resolve(file));
		this.readonly = this.db.readonly;
	}
	getUnit(uname: string, shape: { [col: string]: string }): StorageUnit {
		this.statement(
			`CREATE TABLE IF NOT EXISTS ${uname} (
				${Object.entries(shape)
					.map((k, v) => k + " " + v)
					.join(", ")}
			);`
		).run();

		return new (
			Object.keys(shape).length === 2 && shape.key && shape.value
				? KVStorageUnit
				: StorageUnit
		)(uname, this);
	}
	statement(str: string): BS3.Statement {
		// do NOT use this directly!
		return this.db.prepare(str);
	}
	encodeValue(v: string | number | boolean | null | undefined): string {
		if (v === null || v === undefined) {
			return "NULL";
		} else if (typeof v === "string") {
			return `"${v.replace('"', '\\"')}"`;
		} else {
			return v.toString();
		}
	}
}

class StorageUnit {
	// represents a table
	name: string;
	storage: Storage;
	constructor(uname: string, storage: Storage) {
		this.name = uname;
		this.storage = storage;
	}
	select(
		cols: string[] | string,
		where: string | { [col: string]: number | string }
	) {
		// TODO: allow more complex objects with more operators
		return this.storage.statement(
			`SELECT ${typeof cols === "string" ? cols : cols.join(", ")} FROM ${
				this.name
			} WHERE ${
				typeof where === "string"
					? where
					: Object.entries(where).map(
							([c, v]) => c + " == " + this.storage.encodeValue(v)
					  )
			};`
		);
	}
	replace(values: { [col: string]: number | string }) {
		this.storage.statement(
			`REPLACE INTO ${this.name} (${Object.keys(values).join(
				", "
			)}) VALUES (${Object.values(values)
				.map(this.storage.encodeValue)
				.join(", ")})`
		);
	}
}

class KVStorageUnit extends StorageUnit {
	getValue(key: string, def: number | string) {
		return this.select("value", { key }).pluck().get() ?? def;
	}
	setValue(key: string, value: number | string) {
		return this.replace({ key, value });
	}
}
