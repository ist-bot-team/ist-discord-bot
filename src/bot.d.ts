// General types

export type MessageComponentInteractionHandler<T> = {
	[prefix: string]: (interaction: T) => Promise<void>;
};
