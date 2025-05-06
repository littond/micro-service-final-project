import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const REGION = process.env.AWS_REGION || 'us-east-1';
const dynamoDbClient = new DynamoDBClient({ region: REGION });
const snsClient = new SNSClient({ region: REGION });
const ARN = 'arn:aws:sns:us-east-1:557690622184:LowInventoryAlerts';

export async function handler(event) {
    const product = JSON.parse(event.Records[0].body).product;

    // 2) Fetch current stock from DynamoDB
    let quantity;
    try {
        const { Item } = await dynamoDbClient.send(new GetItemCommand({
            TableName: 'inventory',
            Key: {
                product: { S: product }
            }
        }));
        if (!Item || !Item.product) {
            console.warn(`No stock attribute found for product "${product}", skipping.`);
        }
        quantity = parseInt(Item.quantity.N, 10);
    } catch (err) {
        console.error(`Error fetching inventory for "${product}":`, err);
    }

    // 3) If stock is below threshold, publish an SNS alert
    if (quantity < 5) {
        try {
            await snsClient.send(new PublishCommand({
                TopicArn: ARN,
                Subject: 'Low Inventory Alert',
                Message: `${product} has low quantity (${quantity} left)`
            }));
            console.log(`Low inventory alert sent for "${product}" (stock: ${quantity}).`);
        } catch (err) {
            console.error(`Error publishing SNS alert for "${product}":`, err);
        }
    }

    // SQS‐triggered Lambdas don't need to return a body, but we return something for safety
    return { statusCode: 200 };
}
