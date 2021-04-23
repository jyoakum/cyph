import {database, getTokenKey, onRequest} from '../init.js';
import {namespaces} from '../namespaces.js';
import * as tokens from '../tokens.js';
import {validateInput} from '../validation.js';

export const getSubscriptionData = onRequest(
	true,
	async (req, res, namespace) => {
		const {accountsURL} = namespaces[namespace];
		const userToken = validateInput(req.body.userToken);

		const {username} = await tokens.open(
			userToken,
			await getTokenKey(namespace)
		);

		const internalURL = `${namespace}/users/${username}/internal`;

		const appStoreReceiptRef = database.ref(
			`${internalURL}/appStoreReceipt`
		);
		const braintreeSubscriptionIDRef = database.ref(
			`${internalURL}/braintreeSubscriptionID`
		);

		const emailRef = database.ref(`${internalURL}/email`);

		const planTrialEndRef = database.ref(`${internalURL}/planTrialEnd`);

		const stripeRef = database.ref(`${internalURL}/stripe`);

		const [
			appStoreReceipt,
			braintreeSubscriptionID,
			email,
			planTrialEnd,
			stripeData
		] = await Promise.all([
			appStoreReceiptRef.once('value').then(o => o.val() || ''),
			braintreeSubscriptionIDRef.once('value').then(o => o.val() || ''),
			emailRef.once('value').then(o => o.val() || ''),
			planTrialEndRef.once('value').then(o => o.val() || 0),
			stripeRef.once('value').then(o => o.val() || {})
		]);

		return {
			appStoreReceipt,
			braintreeSubscriptionID,
			email,
			planTrialEnd,
			stripe: stripeData,
			username
		};
	}
);
