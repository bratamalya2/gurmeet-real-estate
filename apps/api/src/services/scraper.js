import axios from 'axios'; import slugify from 'slugify'; import { Property } from '../models/index.js';
const proxy = () => process.env.RESIDENTIAL_PROXY_URL ? { protocol:new URL(process.env.RESIDENTIAL_PROXY_URL).protocol.replace(':',''), host:new URL(process.env.RESIDENTIAL_PROXY_URL).hostname, port:Number(new URL(process.env.RESIDENTIAL_PROXY_URL).port), auth: process.env.RESIDENTIAL_PROXY_USERNAME ? {username:process.env.RESIDENTIAL_PROXY_USERNAME,password:process.env.RESIDENTIAL_PROXY_PASSWORD||''}:undefined } : undefined;
export async function syncSource(source) {
 const url = process.env[source === 'zillow' ? 'ZILLOW_AGENT_PROFILE_URL':'REDFIN_AGENT_PROFILE_URL']; if(!url) throw new Error(`${source} profile URL is not configured`);
 // Provider adapters belong here. This deliberately accepts structured JSON returned by an authorized source/profile feed.
 const { data } = await axios.get(url,{proxy:proxy(),headers:{'User-Agent':'HomesByGurmeet data sync/1.0'}});
 const listings = Array.isArray(data?.listings) ? data.listings : [];
 let created=0,updated=0;
 for (const item of listings) { const normalized=`${item.address||''}`.toLowerCase().replace(/\W/g,''); const existing=await Property.findOne({$or:[{'source.externalId':item.id},{'address.normalized':normalized}]}); const patch={ source:{name:source,externalId:item.id,url:item.url,lastSyncedAt:new Date()},scraped:{price:item.price,status:item.status,description:item.description,images:item.images||[]},status:item.status==='Sold'?'Sold':item.status==='Pending'?'Pending':'Active'}; if(!existing){ await Property.create({title:item.title||item.address,slug:slugify(item.address||item.id,{lower:true,strict:true}),address:{street:item.address,normalized},price:item.price,beds:item.beds,baths:item.baths,sqft:item.sqft,description:item.description,images:item.images||[],...patch}); created++; } else { if(!existing.manualOverrides?.price) patch.price=item.price; if(!existing.manualOverrides?.description) patch.description=item.description; if(!existing.manualOverrides?.images) patch.images=item.images||[]; await Property.updateOne({_id:existing._id},{$set:patch}); updated++; }
 } return {created,updated};
}
