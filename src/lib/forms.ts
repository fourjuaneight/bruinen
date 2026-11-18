/** What the create action sends back on failure (and what CreateForm renders from it). */
export interface CreateFormState {
	message?: string;
	fields?: Record<string, string>;
	values?: Record<string, string | string[]>;
	pending?: boolean;
}
