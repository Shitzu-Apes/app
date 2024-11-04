<div class="container">
  <h1>Create Token API Documentation</h1>

  <section>
    <h2>Overview</h2>
    <p>
      This endpoint allows you to create a new meme token on the NEAR blockchain
      through the Meme Cooking platform. The API requires authentication via a
      Bearer token and accepts form data parameters.
    </p>
  </section>

  <section>
    <h2>Authentication</h2>
    <p>
      Include an Authorization header with a Bearer token:
      <code>Authorization: Bearer YOUR_ENDPOINT_SECRET</code>
    </p>
  </section>

  <section>
    <h2>Endpoint</h2>
    <code>POST /api/create_token</code>
  </section>

  <section>
    <h2>Parameters</h2>
    <table>
      <tr>
        <th>Field</th>
        <th>Type</th>
        <th>Required</th>
        <th>Description</th>
      </tr>
      <tr>
        <td>name</td>
        <td>string</td>
        <td>Yes</td>
        <td>Token name</td>
      </tr>
      <tr>
        <td>symbol</td>
        <td>string</td>
        <td>Yes</td>
        <td>Token symbol</td>
      </tr>
      <tr>
        <td>decimals</td>
        <td>integer</td>
        <td>Yes</td>
        <td>Number of decimal places</td>
      </tr>
      <tr>
        <td>durationMs</td>
        <td>string</td>
        <td>Yes</td>
        <td>Duration in milliseconds</td>
      </tr>
      <tr>
        <td>totalSupply</td>
        <td>string</td>
        <td>Yes</td>
        <td>Total token supply</td>
      </tr>
      <tr>
        <td>icon</td>
        <td>string</td>
        <td>Yes</td>
        <td>Base64 encoded image data</td>
      </tr>
      <tr>
        <td>softCap</td>
        <td>string</td>
        <td>Yes</td>
        <td>Soft cap amount</td>
      </tr>
      <tr>
        <td>hardCap</td>
        <td>string</td>
        <td>No</td>
        <td>Hard cap amount</td>
      </tr>
      <tr>
        <td>teamAllocation</td>
        <td>object</td>
        <td>No</td>
        <td>Team allocation configuration</td>
      </tr>
    </table>
  </section>

  <section>
    <h2>Example Usage (Python)</h2>
    <pre>
      <code>
import base64
import json
import requests

def create_token(
    name: str,
    symbol: str,
    decimals: int,
    duration_ms: str,
    total_supply: str,
    icon: str,
    soft_cap: str,
    hard_cap: str = None,
    team_allocation: dict = None
):
    api_url = &quot;YOUR_API_URL&quot;
    endpoint_secret = &quot;YOUR_ENDPOINT_SECRET&quot;

    form_data = {"{"}
        &quot;name&quot;: name,
        &quot;symbol&quot;: symbol,
        &quot;decimals&quot;: str(decimals),
        &quot;durationMs&quot;: duration_ms,
        &quot;totalSupply&quot;: total_supply,
        &quot;icon&quot;: icon,
        &quot;softCap&quot;: soft_cap
    {"}"}

    if hard_cap:
        form_data[&quot;hardCap&quot;] = hard_cap

    if team_allocation:
        form_data[&quot;teamAllocation&quot;] = json.dumps(team_allocation)

    headers = {"{"}
        &quot;Authorization&quot;: f&quot;Bearer {"{"}endpoint_secret{"}"}&quot;
    {"}"}

    response = requests.post(
        f&quot;{"{"}api_url{"}"}/api/create_token&quot;,
        headers=headers,
        files={"{"}k: (None, v) for k, v in form_data.items(){"}"} 
    )

    if response.status_code != 200:
        raise Exception(f&quot;Failed to create token: {"{"}response.text{"}"}&quot;)

    return response.json()

# Example usage:
with open(&quot;icon.png&quot;, &quot;rb&quot;) as f:
    icon_base64 = base64.b64encode(f.read()).decode('utf-8')

icon = f&quot;data:image/png;base64,{"{"}icon_base64{"}"}&quot;

result = create_token(
    name=&quot;My Token&quot;,
    symbol=&quot;MTK&quot;,
    decimals=18,
    duration_ms=&quot;1000000&quot;,
    total_supply=&quot;1000000000000000000000000&quot;,
    icon=icon,
    soft_cap=&quot;10000000000000000000000000&quot;,
    team_allocation={"{"}
        &quot;allocationBps&quot;: 1000,
        &quot;vestingDurationMs&quot;: 31536000000,
        &quot;cliffDurationMs&quot;: 7776000000
    {"}"}
)
      </code>
    </pre>
  </section>

  <section>
    <h2>Response</h2>
    <p>
      The API returns a JSON response with the transaction result from the NEAR
      blockchain. On success, it includes the transaction hash and other
      relevant details.
    </p>
  </section>
</div>

<style>
  :global(body) {
    color: #fff;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  section {
    margin: 2rem 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }

  th,
  td {
    border: 1px solid #444;
    padding: 0.5rem;
    text-align: left;
  }

  th {
    background-color: #333;
  }

  code {
    background: #333;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    color: #fff;
  }

  pre {
    background: #333;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    color: #fff;
  }
</style>
