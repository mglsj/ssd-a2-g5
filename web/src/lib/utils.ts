import { createCn } from "cn/config";
import { createTV } from "tailwind-variants";

// The DESIGN.md type scale and shadows are custom theme keys. Without this, both
// mergers read `text-heading-3` as a colour and drop it next to `text-muted-foreground`.
const mergeConfig = {
	extend: {
		classGroups: {
			"font-size": [
				{
					text: [
						"display-1",
						"display-2",
						"heading-1",
						"heading-2",
						"heading-3",
						"title",
						"body-md",
						"body-sm",
						"button",
						"caption",
						"eyebrow",
					],
				},
			],
			shadow: [{ shadow: ["soft", "elevated"] }],
		},
	},
};

export const cn = createCn(mergeConfig);

// tailwind-variants bundles its own merger, so components import `tv` from here.
export const tv = createTV({ twMergeConfig: mergeConfig });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
