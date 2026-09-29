// GraphQL client for /graphql.
import { API_URL } from '../config';

export async function graphql(query, variables) {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors.map((e) => e.message).join('; '));
  return data.data;
}

export const gql = {
  catalog: () => graphql('{ catalog { id name description price stock category } }'),
  createOrder: (customerName, items) =>
    graphql(
      `mutation($c: String!, $i: [OrderItemInput]!) { createOrder(customerName:$c, items:$i) { id status total } }`,
      { c: customerName, i: items },
    ),
  updateOrderStatus: (orderId, status) =>
    graphql(`mutation($o: ID!, $s: String!) { updateOrderStatus(orderId:$o, status:$s) { id status } }`, { o: orderId, s: status }),
  cancelOrder: (orderId) => graphql(`mutation($o: ID!) { cancelOrder(orderId:$o) { id status } }`, { o: orderId }),
};
