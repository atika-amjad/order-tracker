'use strict';

const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { buildSchema } = require('graphql');
const catalog = require('../store/catalog');
const orders = require('../store/orders');

const router = express.Router();

// Schema uses the same in-memory store as REST + RPC, so mutations fan out
// through the event bus to SSE + Socket.io identically.
const schema = buildSchema(`
  type Product {
    id: ID!
    name: String!
    description: String
    price: Float!
    stock: Int!
    category: String
  }
  type OrderItem {
    productId: ID!
    name: String!
    qty: Int!
    price: Float!
  }
  type Order {
    id: ID!
    customerName: String!
    items: [OrderItem]!
    total: Float!
    status: String!
    createdAt: String!
    updatedAt: String!
  }
  input OrderItemInput {
    productId: ID!
    qty: Int!
  }
  type Query {
    catalog: [Product]
    product(id: ID!): Product
    orders(status: String): [Order]
    order(id: ID!): Order
  }
  type Mutation {
    createOrder(customerName: String!, items: [OrderItemInput]!): Order
    updateOrderStatus(orderId: ID!, status: String!): Order
    cancelOrder(orderId: ID!): Order
  }
`);

const root = {
  catalog: () => catalog.list(),
  product: ({ id }) => catalog.get(id),
  orders: ({ status }) => orders.list({ status }),
  order: ({ id }) => orders.get(id),
  createOrder: ({ customerName, items }) => orders.create({ customerName, items }),
  updateOrderStatus: ({ orderId, status }) => orders.updateStatus(orderId, status),
  cancelOrder: ({ orderId }) => orders.cancel(orderId),
};

router.use('/', graphqlHTTP({
  schema,
  rootValue: root,
  graphiql: true,
}));

module.exports = router;
