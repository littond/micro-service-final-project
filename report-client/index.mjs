import {
    DynamoDBClient,
    ScanCommand
} from "@aws-sdk/client-dynamodb";
import {
    S3Client,
    PutObjectCommand
} from "@aws-sdk/client-s3";
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",                           // or your exact origin
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT"
};
// Change region or pick up from process.env.AWS_REGION
const REGION = "us-east-1";
const dynamo = new DynamoDBClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

// Hard-coded bucket name per your request
const REPORT_BUCKET = "inv-ord-report-bucket";

export async function handler(event) {
    // 1) Determine mode
    let mode;
    try {
        // support direct invocation or API Gateway (JSON body)
        const payload = event.body ? JSON.parse(event.body) : event;
        mode = payload.mode;
    } catch (err) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: "Invalid payload; could not parse JSON",
            }),
        };
    }

    if (!["inventory", "sales"].includes(mode)) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message:
                    "Missing or invalid `mode` (must be 'inventory' or 'sales')",
            }),
        };
    }

    // 2) Scan DynamoDB (with pagination)
    const tableName = mode === "inventory"
        ? "inventory"
        : "orders";

    const items = [];
    let ExclusiveStartKey;
    try {
        do {
            const resp = await dynamo.send(
                new ScanCommand({
                    TableName: tableName,
                    ExclusiveStartKey,
                })
            );
            if (resp.Items) {
                items.push(...resp.Items);
            }
            ExclusiveStartKey = resp.LastEvaluatedKey;
        } while (ExclusiveStartKey);
    } catch (err) {
        console.error("DynamoDB scan error:", err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: `Error scanning ${tableName}`,
                error: err.message,
            }),
        };
    }

    // 3) Build CSV
    // define headers based on mode
    const headers = mode === "inventory"
        ? ["product", "quantity"]
        : ["orderId", "product", "quantity", "orderDate"];

    // CSV header row
    const rows = [headers.join(",")];

    // map each DynamoDB item to a CSV line
    for (const it of items) {
        const cols = headers.map((h) => {
            const attr = it[h];
            // handle string or number attributes
            if (!attr) return "";
            if ("S" in attr) return `"${attr.S.replace(/"/g, '""')}"`;
            if ("N" in attr) return attr.N;
            return "";
        });
        rows.push(cols.join(","));
    }

    const csvContent = rows.join("\n");

    // 4) Upload to S3
    const timestamp = new Date().toISOString();
    const key = `${mode}-report-${timestamp}.csv`;

    try {
        await s3.send(
            new PutObjectCommand({
                Bucket: REPORT_BUCKET,
                Key: key,
                Body: csvContent,
                ContentType: "text/csv",
            })
        );
    } catch (err) {
        console.error("S3 upload error:", err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                message: "Failed to upload report to S3",
                error: err.message,
            }),
        };
    }

    return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
            message: "Report generated successfully",
            bucket: REPORT_BUCKET,
            key,
            recordCount: items.length,
        }),
    };
}
