/**
 * Code samples for the developer portal, one builder per endpoint per language.
 *
 * These are the API's real documentation — a developer copies them into a terminal or an
 * editor and expects them to run, so they're built from the account's OWN base URL and
 * sender ID rather than left as placeholders to fill in. The only thing a reader must
 * substitute is the key itself, which we can't show them.
 */
export const LANGUAGES = [
  { id: 'curl', label: 'cURL' },
  { id: 'node', label: 'Node.js' },
  { id: 'php', label: 'PHP' },
  { id: 'python', label: 'Python' },
] as const

export type LanguageId = (typeof LANGUAGES)[number]['id']

export interface SnippetContext {
  /**
   * The API origin, e.g. https://api.cheqam.com — no trailing slash.
   *
   * Samples target "/api/v1", not the prettier "/v1", because that is the path the
   * production reverse proxy actually forwards to the service. The server answers on both,
   * so publishing the one that is guaranteed reachable means a copied sample always runs.
   */
  baseUrl: string
  /** One of the account's approved sender IDs, so the sample is runnable as-is. */
  senderId: string
}

const KEY = 'sk_live_your_key'

// ── Send one message (the OTP / transactional case) ──────────────────────────
export function singleSend({ baseUrl, senderId }: SnippetContext): Record<LanguageId, string> {
  const body = `{
    "to": "0244000000",
    "from": "${senderId}",
    "content": "Your verification code is 481920.",
    "clientReference": "otp-9f2b1c"
  }`

  return {
    curl: `curl -X POST ${baseUrl}/api/v1/messages \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '${body}'`,

    node: `const res = await fetch("${baseUrl}/api/v1/messages", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${KEY}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: "0244000000",
    from: "${senderId}",
    content: "Your verification code is 481920.",
    clientReference: "otp-9f2b1c",
  }),
})

const { data } = await res.json()
// Sent while the request was open — no polling needed.
console.log(data.messages[0].status) // "sent"`,

    php: `<?php
$ch = curl_init("${baseUrl}/api/v1/messages");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer ${KEY}",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "to" => "0244000000",
        "from" => "${senderId}",
        "content" => "Your verification code is 481920.",
        "clientReference" => "otp-9f2b1c",
    ]),
]);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);

echo $response["data"]["messages"][0]["status"]; // "sent"`,

    python: `import requests

res = requests.post(
    "${baseUrl}/api/v1/messages",
    headers={"Authorization": "Bearer ${KEY}"},
    json={
        "to": "0244000000",
        "from": "${senderId}",
        "content": "Your verification code is 481920.",
        "clientReference": "otp-9f2b1c",
    },
)

data = res.json()["data"]
print(data["messages"][0]["status"])  # "sent"`,
  }
}

// ── Send to many ─────────────────────────────────────────────────────────────
export function bulkSend({ baseUrl, senderId }: SnippetContext): Record<LanguageId, string> {
  return {
    curl: `curl -X POST ${baseUrl}/api/v1/messages \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": ["0244000000", "0201234567", "0554433221"],
    "from": "${senderId}",
    "content": "We are open late this Friday until 9pm."
  }'`,

    node: `const res = await fetch("${baseUrl}/api/v1/messages", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${KEY}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: numbers, // an array — up to 10,000 per request
    from: "${senderId}",
    content: "We are open late this Friday until 9pm.",
  }),
})

const { data } = await res.json()
// Over 10 recipients: queued for sending. Keep the id to check on it.
console.log(data.batchId, data.accepted, data.cost)`,

    php: `<?php
$ch = curl_init("${baseUrl}/api/v1/messages");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer ${KEY}",
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "to" => $numbers, // an array — up to 10,000 per request
        "from" => "${senderId}",
        "content" => "We are open late this Friday until 9pm.",
    ]),
]);

$data = json_decode(curl_exec($ch), true)["data"];
curl_close($ch);

echo $data["batchId"]; // keep this to check on the send`,

    python: `import requests

res = requests.post(
    "${baseUrl}/api/v1/messages",
    headers={"Authorization": "Bearer ${KEY}"},
    json={
        "to": numbers,  # a list — up to 10,000 per request
        "from": "${senderId}",
        "content": "We are open late this Friday until 9pm.",
    },
)

data = res.json()["data"]
print(data["batchId"], data["accepted"], data["cost"])`,
  }
}

// ── Personalised send ────────────────────────────────────────────────────────
export function personalisedSend({ baseUrl, senderId }: SnippetContext): Record<LanguageId, string> {
  return {
    curl: `curl -X POST ${baseUrl}/api/v1/messages \\
  -H "Authorization: Bearer ${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipients": [
      { "phone": "0244000000", "data": { "name": "Ama", "amount": "GHS 40" } },
      { "phone": "0201234567", "data": { "name": "Kojo", "amount": "GHS 15" } }
    ],
    "from": "${senderId}",
    "content": "Hi {{name}}, your balance is {{amount}}."
  }'`,

    node: `const res = await fetch("${baseUrl}/api/v1/messages", {
  method: "POST",
  headers: {
    Authorization: "Bearer ${KEY}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    recipients: customers.map((c) => ({
      phone: c.phone,
      data: { name: c.firstName, amount: c.balance },
    })),
    from: "${senderId}",
    content: "Hi {{name}}, your balance is {{amount}}.",
  }),
})`,

    php: `<?php
$recipients = array_map(fn($c) => [
    "phone" => $c["phone"],
    "data" => ["name" => $c["firstName"], "amount" => $c["balance"]],
], $customers);

curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "recipients" => $recipients,
    "from" => "${senderId}",
    "content" => "Hi {{name}}, your balance is {{amount}}.",
]));`,

    python: `res = requests.post(
    "${baseUrl}/api/v1/messages",
    headers={"Authorization": "Bearer ${KEY}"},
    json={
        "recipients": [
            {"phone": c["phone"], "data": {"name": c["first_name"], "amount": c["balance"]}}
            for c in customers
        ],
        "from": "${senderId}",
        "content": "Hi {{name}}, your balance is {{amount}}.",
    },
)`,
  }
}

// ── Check delivery ───────────────────────────────────────────────────────────
export function checkStatus({ baseUrl }: SnippetContext): Record<LanguageId, string> {
  return {
    curl: `# The whole send
curl ${baseUrl}/api/v1/batches/BATCH_ID \\
  -H "Authorization: Bearer ${KEY}"

# Or one number
curl ${baseUrl}/api/v1/messages/MESSAGE_ID \\
  -H "Authorization: Bearer ${KEY}"`,

    node: `const res = await fetch(\`${baseUrl}/api/v1/batches/\${batchId}\`, {
  headers: { Authorization: "Bearer ${KEY}" },
})

const { data } = await res.json()
console.log(data.delivered, "of", data.totalRecipients, "delivered")`,

    php: `<?php
$ch = curl_init("${baseUrl}/api/v1/batches/" . $batchId);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer ${KEY}"],
]);

$data = json_decode(curl_exec($ch), true)["data"];
curl_close($ch);

echo "{$data['delivered']} of {$data['totalRecipients']} delivered";`,

    python: `res = requests.get(
    f"${baseUrl}/api/v1/batches/{batch_id}",
    headers={"Authorization": "Bearer ${KEY}"},
)

data = res.json()["data"]
print(data["delivered"], "of", data["totalRecipients"], "delivered")`,
  }
}

// ── Balance ──────────────────────────────────────────────────────────────────
export function balance({ baseUrl }: SnippetContext): Record<LanguageId, string> {
  return {
    curl: `curl ${baseUrl}/api/v1/balance \\
  -H "Authorization: Bearer ${KEY}"`,

    node: `const res = await fetch("${baseUrl}/api/v1/balance", {
  headers: { Authorization: "Bearer ${KEY}" },
})

const { data } = await res.json()
if (data.balance < 20) notifyFinanceTeam(data.balance)`,

    php: `<?php
$ch = curl_init("${baseUrl}/api/v1/balance");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer ${KEY}"],
]);

$data = json_decode(curl_exec($ch), true)["data"];
curl_close($ch);

echo $data["balance"]; // remaining GHS`,

    python: `res = requests.get(
    "${baseUrl}/api/v1/balance",
    headers={"Authorization": "Bearer ${KEY}"},
)

data = res.json()["data"]
if data["balance"] < 20:
    notify_finance_team(data["balance"])`,
  }
}
