#!/usr/bin/env node
import { Plans } from '@metacall/protocol/plan';
import API, { API as APIInterface } from '@metacall/protocol/protocol';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import args from './cli/args';
import { inspect } from './cli/inspect';
import { error } from './cli/messages';
import { handleUnknownArgs } from './cli/unknown';
import validateToken from './cli/validateToken';
import { deleteBySelection } from './delete';
import { deployFromRepository, deployPackage } from './deploy';
import { force } from './force';
import { listPlans } from './listPlans';
import { logout } from './logout';
import { plan } from './plan';
import { startup } from './startup';

export enum ErrorCode {
	Ok = 0,
	NotDirectoryRootPath = 1,
	EmptyRootPath = 2,
	NotFoundRootPath = 3,
	AccountDisabled = 4
}

void (async () => {
	if (args['_unknown'].length) handleUnknownArgs();

	if (args['version']) {
		return console.log(
			(
				(await import(
					join(
						require.main
							? join(dirname(require.main.filename), '..')
							: process.cwd(),
						'package.json'
					)
				)) as { version: string }
			).version
		);
	}

	if (args['logout']) return logout();

	const config = await startup(args['confDir']);
	const api: APIInterface = API(
		config.token as string,
		args['dev'] ? config.devURL : config.baseURL
	);

	await validateToken(api);

	if (args['listPlans']) return await listPlans(api);

	if (args['inspect']) return await inspect(config, api);

	if (args['delete']) return await deleteBySelection(api);

	if (args['force']) await force(api);

	// On line 63, we passed Essential to the FAAS in dev environment,
	// the thing is there is no need of plans in Local Faas (--dev),
	// this could have been handlled neatly if we created deploy as a State Machine,
	// think about a better way

	const planSelected: Plans = args['dev'] ? Plans.Essential : await plan(api);

	if (args['addrepo']) {
		try {
			return await deployFromRepository(
				api,
				planSelected,
				new URL(args['addrepo']).href
			);
		} catch (e) {
			error(String(e));
		}
	}

	// If workdir is passed call than deploy using package
	if (args['workdir']) {
		const rootPath = args['workdir'];

		try {
			if (!(await fs.stat(rootPath)).isDirectory()) {
				error(`Invalid root path, ${rootPath} is not a directory.`);
				return process.exit(ErrorCode.NotDirectoryRootPath);
			}
		} catch (e) {
			error(`Invalid root path, ${rootPath} not found.`);
			return process.exit(ErrorCode.NotFoundRootPath);
		}

		try {
			await deployPackage(rootPath, api, planSelected);
		} catch (e) {
			error(String(e));
		}
	}

	if (args['serverUrl']) {
		config.baseURL = args['serverUrl'];
	}
})();

// change all flag names to toUpperCase
// think of a way to write test for --dev flag
