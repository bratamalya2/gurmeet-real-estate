import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const base = { timestamps: true };
export const User = model('User', new Schema({ email:{type:String,unique:true,required:true,lowercase:true}, passwordHash:{type:String,required:true}, role:{type:String,enum:['admin','editor'],default:'editor'}, active:{type:Boolean,default:true} }, base));
export const Property = model('Property', new Schema({ title:String, slug:{type:String,unique:true,index:true}, address:{street:String,city:String,state:String,zip:String,normalized:{type:String,index:true}}, price:Number, beds:Number, baths:Number, sqft:Number, description:String, status:{type:String,enum:['Active','Pending','Sold'],default:'Active'}, featured:{type:Boolean,default:false}, images:[String], photoManifest:{imageUrl:String,originalImageUrl:String,imageUrls:{type:[String],default:[]},originalImageUrls:{type:[String],default:[]},propertyPages:{type:[String],default:[]},photoSources:{type:[String],default:[]},propertyPage:String,photoSource:String,verificationNotes:String,pages:String,importedAt:Date,managedImagePaths:{type:[String],default:[]},driveFileIds:{type:[String],default:[]},driveFolderUrl:String,downloadedAt:Date}, coordinates:{lat:Number,lng:Number}, source:{name:{type:String,default:'manual'},externalId:String,url:String,lastSyncedAt:Date,providers:[String]}, scraped:{price:Number,status:String,description:String,images:[String]}, manualOverrides:{price:Boolean,description:Boolean,images:Boolean}, transaction:{soldDate:Date,side:String,verification:String,confidence:String,notes:String,imageSearchUrl:String}, createdBy:{type:Schema.Types.ObjectId,ref:'User'} }, base));
export const Lead = model('Lead', new Schema({ type:{type:String,enum:['inquiry','showing','valuation','contact'],required:true}, name:String,email:String,phone:String,message:String,property:{type:Schema.Types.ObjectId,ref:'Property'}, preferredDate:Date, propertyAddress:String,squareFootage:Number,condition:String }, base));
export const WorkbookImport = model('WorkbookImport', new Schema({
  source:{type:String,enum:['workbook','redfin','zillow','photos'],unique:true,required:true},
  filename:{type:String,required:true},
  checksum:{type:String,required:true},
  rowCount:{type:Number,required:true},
  rows:{type:[Schema.Types.Mixed],default:[]},
  uploadedAt:{type:Date,default:Date.now},
}, base));
export const AnalyticsEvent = model('AnalyticsEvent', new Schema({
  type:{type:String,enum:['page_view','listing_view'],required:true,index:true},
  path:{type:String,required:true,maxlength:300},
  property:{type:Schema.Types.ObjectId,ref:'Property'},
  createdAt:{type:Date,default:Date.now,index:{expires:60 * 60 * 24 * 730}},
}, { timestamps:false }));
AnalyticsEvent.schema.index({ type: 1, createdAt: 1 });
AnalyticsEvent.schema.index({ property: 1, createdAt: 1 });
export const SystemLog = model('SystemLog', new Schema({ source:String, status:{type:String,enum:['success','partial','failed','running'],default:'running'}, startedAt:Date,completedAt:Date,created:Number,updated:Number,removed:Number,sourceRows:Number,totalListings:Number,filename:String,error:String }, base));
