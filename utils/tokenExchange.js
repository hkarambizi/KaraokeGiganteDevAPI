import axios from "axios";

async function exchangeCustomTokenForIdToken(customToken, apiKey) {
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
	const { data } = await axios.post(url, {
		token: customToken,
		returnSecureToken: true,
	});
	return data.idToken;
}

export { exchangeCustomTokenForIdToken };
