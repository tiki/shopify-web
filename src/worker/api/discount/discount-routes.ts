/*
 * Copyright (c) TIKI Inc.
 * MIT license. See LICENSE file in root directory.
 */

import { IRequest, json } from 'itty-router';
import { DiscountReq } from './discount-req';
import { Throw, API } from '@mytiki/worker-utils-ts';
import { Shopify } from '../../shopify/shopify';
import { DiscountRsp } from './discount-rsp';
import { mutation } from 'gql-query-builder';
import { StagedUploadResponse } from '../../../worker/shopify/shopify-mutations-types';
import { useAppBridge } from '@shopify/app-bridge-react/useAppBridge';
import { useAuthenticatedFetch } from '../../../hooks/useAuthenticatedFetch';

export async function create(request: IRequest, env: Env): Promise<Response> {
  const token = request.headers.get(API.Consts.AUTHORIZATION);
  if (token == null) {
    throw new API.ErrorBuilder()
      .help('Check your Authorization header')
      .error(403);
  }

  const claims = await Shopify.verifySession(
    token.replace('Bearer ', ''),
    env.KEY_ID,
    env.KEY_SECRET,
  );
  const body: DiscountReq = await request.json();
  guard(body);
  Throw.ifNull(claims.dest);

  const shopDomain = (claims.dest as string).replace(/^https?:\/\//, '');
  const shopify = new Shopify(shopDomain, env);
  const accessToken = await shopify.getToken();
  const install = await shopify.getInstall(accessToken);
  const rsp: DiscountRsp = {
    id: await shopify.createDiscount(
      body,
      install.data.currentAppInstallation.id,
    ),
  };
  return json(rsp);
}

export async function get(
  request: IRequest,
  env: Env,
  ctx: { id: string },
): Promise<Response> {
  const token = request.headers.get(API.Consts.AUTHORIZATION);
  if (token == null) {
    throw new API.ErrorBuilder()
      .help('Check your Authorization header')
      .error(403);
  }

  const claims = await Shopify.verifySession(
    token.replace('Bearer ', ''),
    env.KEY_ID,
    env.KEY_SECRET,
  );
  const shopify = new Shopify(claims.dest as string, env);
  const rsp = await shopify.getDiscountById(ctx.id);
  return json(rsp);
}

export async function stagedUpload(request: IRequest, env: Env) {
  try {
    type requestImage = {
      name: string,
      mimeType: string
    }

    const body: requestImage = await request.json()
    
    let stagedUploadsQuery = mutation({
      operation: 'stagedUploadsCreate',
      //variables: ,
      fields: [
        {
          userErrors: ['message', 'field'],
          stagedTargets: [
            'url',
            'resourceUrl',
            {
              parameters: ['name', 'value'],
            },
          ],
        },
      ],
    });
    const token = request.headers?.get(API.Consts.AUTHORIZATION);
    
    const shop_url = 'https://tiki-test-store.myshopify.com';

    //const shop_url = app.hostOrigins
    stagedUploadsQuery.variables = { 
      input:[
      {
      filename: body.name,
      httpMethod: 'POST',
      mimeType: `image/${body.mimeType}`,
      resource: 'FILE',
      }
      ]
    }
    const mutationBody = JSON.stringify(stagedUploadsQuery);
    console.log(mutationBody);
    const stagedUploadsQueryResult = await fetch(
      `${shop_url}/admin/api/2023-07/graphql.json`,
      {
        method: 'POST',
        headers: {
          Authorization: token!,
        }, 
        body: mutationBody,
      },
    );

    const target: StagedUploadResponse = await stagedUploadsQueryResult.json();
    console.log('target', target)
    return target;
    //  console.log('target', target)
    //  const params = target.data.stagedUploadsCreate.stagedTargets[0]["parameters"];
    //  const url = target.data.stagedUploadsCreate.stagedTargets[0]["url"];
    //  const resourceUrl = target.data.stagedUploadsCreate.stagedTargets[0]["resourceUrl"];
  } catch (error) {
    console.log(error);
  }
}

function guard(req: DiscountReq): void {
  Throw.ifNull(req.title, 'title');
  Throw.ifNull(req.startsAt, 'startsAt');

  Throw.ifNull(req.metafields, 'metafields');
  Throw.ifNull(req.metafields.type, 'metafields.type');

  Throw.ifNull(req.combinesWith, 'combinesWith');
  Throw.ifNull(req.combinesWith.orderDiscounts, 'combinesWith.orderDiscounts');
  Throw.ifNull(
    req.combinesWith.productDiscounts,
    'combinesWith.productDiscounts',
  );
  Throw.ifNull(
    req.combinesWith.shippingDiscounts,
    'combinesWith.shippingDiscounts',
  );
}
