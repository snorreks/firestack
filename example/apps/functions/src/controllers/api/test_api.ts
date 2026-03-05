import type { RequestFunctions } from "@shared/types";
import { test } from "@shared/utils";
import { FirestackError, onRequest } from "@snorreks/firestack";
import { getFirestore } from "$configs/database.ts";

export default onRequest<RequestFunctions, "test_api", { p: string }>(
	(request, response) => {
		console.log(`message ${request.body.message}`);
		console.log(`params ${request.params.p}`);

		const firestore = getFirestore();

		if (request.body.message === "error") {
			throw new FirestackError("invalid-argument", "Message cannot be 'error'");
		}

		response.send({
			dataFromSharedLib: test(),
			test: "test",
		});
	},
	{
		region: "europe-west1",
	},
);
