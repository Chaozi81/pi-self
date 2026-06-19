import type { Schema as S } from "effect";
import { type TSchema, Type } from "typebox";

const DescSymbol = Symbol.for("effect/annotation/Description");

type EffectSchema = S.Schema<any, any, never>;

export function effectSchemaToTypeBox(schema: EffectSchema): TSchema {
	return convert(schema);
}

function convertFromAst(ast: Record<string, unknown>): TSchema {
	return convert({ ast } as unknown as EffectSchema);
}

function unwrapOptional(ast: Record<string, unknown>): Record<string, unknown> {
	if (ast._tag === "Union" && Array.isArray(ast.types)) {
		const inner = (ast.types as Array<Record<string, unknown>>).find((t) => t._tag !== "UndefinedKeyword");
		if (inner) return inner;
	}
	return ast;
}

function convert(schema: EffectSchema): TSchema {
	const ast = schema.ast as unknown as Record<string, unknown>;
	const tag = ast._tag as string;

	if (tag === "TypeLiteral") {
		const propertySignatures = ast.propertySignatures as Array<{
			name: string;
			type: Record<string, unknown>;
			isOptional: boolean;
		}>;
		const props: Record<string, TSchema> = {};

		for (const ps of propertySignatures) {
			const key = ps.name;
			const innerAst = ps.isOptional ? unwrapOptional(ps.type) : ps.type;
			const boxed = convertFromAst(innerAst);
			props[key] = ps.isOptional ? Type.Optional(boxed) : boxed;
		}

		const result = Type.Object(props);

		const astAnnotations = ast.annotations as Record<string | symbol, string> | undefined;
		const containerDesc = astAnnotations?.[DescSymbol];
		if (containerDesc) {
			(result as unknown as Record<string, unknown>).description = containerDesc;
		}

		return result;
	}

	if (tag === "StringKeyword") {
		const result = Type.String();
		const astAnnotations = ast.annotations as Record<string | symbol, string> | undefined;
		const desc = astAnnotations?.[DescSymbol];
		if (desc) {
			(result as unknown as Record<string, unknown>).description = desc;
		}
		return result;
	}

	if (tag === "NumberKeyword") {
		return Type.Number();
	}

	if (tag === "BooleanKeyword") {
		return Type.Boolean();
	}

	if (tag === "TupleType") {
		const rest = ast.rest as Array<{ type: Record<string, unknown> }> | undefined;
		const elementAst = rest?.[0]?.type;
		if (elementAst) {
			const elementSchema = effectSchemaToTypeBox({ ast: elementAst } as unknown as EffectSchema);
			return Type.Array(elementSchema);
		}
	}

	if (tag === "Union") {
		const types = ast.types as Array<Record<string, unknown>>;
		const members = types.map((t) => effectSchemaToTypeBox({ ast: t } as unknown as EffectSchema));
		return Type.Union(members);
	}

	if (tag === "Literal") {
		const literal = ast.literal;
		if (literal === null) {
			return Type.Null();
		}
		return Type.Literal(literal as string | number | boolean);
	}

	console.warn(`[opencode-bridge] Unsupported Effect Schema AST tag "${tag}", degrading to Type.Any()`);
	return Type.Any();
}
