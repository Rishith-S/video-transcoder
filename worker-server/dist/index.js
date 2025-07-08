"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pubsub_1 = require("@google-cloud/pubsub");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Set your GCP project ID and subscription name
const projectId = 'triple-router-457903-n9';
const subscriptionName = 'my-upload-topic-sub'; // or create a new one
// Create a Pub/Sub client
const pubsub = new pubsub_1.PubSub({ projectId });
// Reference the subscription
const subscription = pubsub.subscription(subscriptionName);
// Listen for new messages
subscription.on('message', message => {
    console.log('Received message:');
    console.log(`ID: ${message.id}`);
    console.log(`Data: ${message.data}`);
    console.log(`Attributes: ${JSON.stringify(message.attributes)}`);
    // Acknowledge the message
    message.ack();
});
// Handle errors
subscription.on('error', error => {
    console.error('Received error:', error);
});
