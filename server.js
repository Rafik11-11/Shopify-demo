// core module 
// const path = require('path');

// // our third party modules
import dotenv from "dotenv";
dotenv.config(); // Required in ES modules
import express from "express";
import cors from "cors";
import morgan from "morgan";
import multer from "multer";
import fetch from 'node-fetch' ;
import path from "path";
import {queryAssistant, voiceToText} from "./openai.js";
const app = express()
// chains of middlewares
app.use(cors());
app.use(morgan('dev'))
app.use(express.json())
const upload = multer({
    storage: multer.memoryStorage(), // Store file in memory
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    }
  });
  

const port = process.env.PORT || 5000
const smartSearch = async (req, res) => {
    try {
        console.log(req.body);

        if (req.file) {
            const text = await voiceToText(req.file.buffer);
            console.log("Transcribed text:", text);
            const response = await queryAssistant(text);
            console.log("Assistant's response:", response);
            return res.json({ answer: response });
        } else {
            console.log(req.body);
            let assistant_id = '' ;
            if (!req.body.shop) assistant_id = process.env.ASSISTANT_ID;
            else assistant_id = process.env.ASSISTANT_ID_SHOP;
            console.log('Prompt:', req.body.prompt);
            const response = await queryAssistant(req.body.prompt,assistant_id);
            console.log("Assistant's response:", response);
            return res.json({ answer: response });
        }
    } catch (error) {
        console.error('Error processing audio:', error);
        return res.status(500).json({ error: 'Error processing audio file' });
    }
};
async function fetchAllCollectionProducts() {
    const endpoint = 'https://test-rafik-app.myshopify.com/api/2025-01/graphql.json';
    const accessToken = '3761dbe3cd084e8af5099cd358da9a91';

    const query = `
    {
      products(first: 10) {
        edges {
          node {
            id
            title
            description
            onlineStoreUrl
            images(first: 1) {
              edges {
                node {
                  src
                }
              }
            }
          }
        }
      }
    }`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': accessToken,
        },
        body: JSON.stringify({ query }),
    });

    const responseBody = await response.json();

    if (responseBody.errors) {
        console.error('GraphQL errors:', responseBody.errors);
        throw new Error('Failed to fetch products');
    }

    return responseBody.data.products.edges.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        description: edge.node.description,
        onlineStoreUrl: edge.node.onlineStoreUrl,
        images: edge.node.images.edges.map(imgEdge => ({ src: imgEdge.node.src }))
    }));
}


app.post('/openai', upload.single('audio'), smartSearch);
app.get('/app-proxy', async (req, res) => {
    try {
        console.log('Received request from app proxy');

        // Fetch products
        const products = await fetchAllCollectionProducts();

        // Convert the products to a Liquid-compatible format
        const liquidProducts = products.map(product => ({
            id: product.id,
            title: product.title,
            description: product.description,
            url: product.onlineStoreUrl || '#',
            featured_image: product.images.length > 0 ? product.images[0].src : '',
            price: "N/A" // Storefront API does not return prices, you need Admin API for that
        }));

        // Construct the Liquid template with variables
        const liquidContent = `
        {% layout 'theme' %}
        {% assign collection = ${JSON.stringify({ title: "All Products", description: "Browse our collection", products: liquidProducts })} %}
        <div>
            <h1>{{ collection.title }}</h1>
            <div class="collection-description">{{ collection.description }}</div>
            <div class="product-grid">
                {% for product in collection.products %}
                    <div class="product-item">
                        <a href="{{ product.url }}">
                            <img src="{{ product.featured_image }}" alt="{{ product.title }}">
                            <h2>{{ product.title }}</h2>
                            <p>{{ product.price | money }}</p>
                        </a>
                    </div>
                {% endfor %}
            </div>
        </div>
        `;

        res.setHeader('Content-Type', 'application/liquid');
        res.send(liquidContent);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});








app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
