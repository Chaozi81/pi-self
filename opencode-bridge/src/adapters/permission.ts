import { Effect, Layer } from "effect";

export interface PermissionShape {
	readonly assert: (opts: {
		readonly action: string;
		readonly resources: string[];
		readonly save?: string[];
		readonly sessionID: string;
		readonly agent: string;
		readonly source: { readonly type: string; readonly messageID: string; readonly callID: string };
	}) => Effect.Effect<void>;
}

export class Permission extends Effect.Tag("PermissionV2.Service")<Permission, PermissionShape>() {}

export function makePermissionAdapter(): Layer.Layer<Permission> {
	return Layer.succeed(Permission, {
		assert: () => Effect.void,
	});
}
