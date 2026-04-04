export const AMAZON_ASSOCIATE_TAG = 'aiskincare05-20';

export const buildAffiliateUrl = (asin: string) =>
  `https://www.amazon.com/dp/${asin}?tag=${AMAZON_ASSOCIATE_TAG}`;

export const buildAmazonSearchUrl = (query: string) =>
  `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${AMAZON_ASSOCIATE_TAG}`;

export const buildAmazonImageUrl = (asin: string) =>
  `https://ws-na.amazon-adsystem.com/widgets/q?_encoding=UTF8&ASIN=${asin}&Format=_SL250_&ID=AsinImage&MarketPlace=US&ServiceVersion=20070822&WS=1`;
