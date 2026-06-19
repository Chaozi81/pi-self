import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { effectSchemaToTypeBox } from "../src/schema.ts";

describe("effectSchemaToTypeBox", () => {
	it("converts Schema.String", () => {
		const result = effectSchemaToTypeBox(Schema.String);
		expect(result).toBeDefined();
	});

	it("converts Schema.Number", () => {
		const result = effectSchemaToTypeBox(Schema.Number);
		expect(result).toBeDefined();
	});

	it("converts Schema.Boolean", () => {
		const result = effectSchemaToTypeBox(Schema.Boolean);
		expect(result).toBeDefined();
	});

	it("converts Schema.Array(Schema.String)", () => {
		const schema = Schema.Array(Schema.String);
		const result = effectSchemaToTypeBox(schema);
		expect(result).toBeDefined();
	});

	it("converts Schema.Struct with properties", () => {
		const schema = Schema.Struct({
			name: Schema.String,
			age: Schema.Number,
		});
		const result = effectSchemaToTypeBox(schema);
		expect(result).toBeDefined();
		const props = (result as Record<string, unknown>).properties as Record<string, unknown> | undefined;
		expect(props).toBeDefined();
		expect(props!.name).toBeDefined();
		expect(props!.age).toBeDefined();
	});

	it("converts Schema optional via pipe(Schema.optional)", () => {
		const schema = Schema.Struct({
			name: Schema.String.pipe(Schema.optional),
		});
		const result = effectSchemaToTypeBox(schema);
		expect(result).toBeDefined();
	});

	it("converts Schema.Union", () => {
		const schema = Schema.Union(Schema.String, Schema.Number);
		const result = effectSchemaToTypeBox(schema);
		expect(result).toBeDefined();
	});

	it("converts Schema.Literal", () => {
		const schema = Schema.Literal("hello");
		const result = effectSchemaToTypeBox(schema);
		expect(result).toBeDefined();
	});

	it("converts Schema.Null", () => {
		const result = effectSchemaToTypeBox(Schema.Null);
		expect(result).toBeDefined();
	});

	it("extracts description from annotations", () => {
		const schema = Schema.Struct({
			path: Schema.String.annotations({ description: "File path to read" }),
		});
		const result = effectSchemaToTypeBox(schema);
		const props = (result as Record<string, unknown>).properties as Record<string, Record<string, unknown>>;
		expect(props.path.description).toBe("File path to read");
	});

	it("degrades unsupported combinators to Type.Any()", () => {
		const BrandedString = Schema.String.pipe(Schema.brand("MyBrand"));
		const result = effectSchemaToTypeBox(BrandedString);
		expect(result).toBeDefined();
	});
});
