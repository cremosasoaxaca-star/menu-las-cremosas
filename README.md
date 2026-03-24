# 🍓 Las Cremosas — Menú Web + Sistema de Caja

Sistema web para gestión de menú dinámico y control de ventas/gastos conectado a Google Sheets.

---

## 🚀 Demo
https://cremosasoaxaca-star.github.io/menu-las-cremosas/

---

## 🧠 ¿Qué es este proyecto?

Aplicación web que permite:

### 🎯 Parte pública
- Ver menú dinámico
- Buscar y filtrar productos
- Ver disponibilidad
- Personalizar productos
- Pedir por WhatsApp

### 🔐 Parte privada (caja)
- Registrar ventas
- Registrar gastos
- Ver corte del día
- Ver utilidad

---

## 🧩 Arquitectura

Frontend (HTML + CSS + JS)
↓
Google Sheets
↓
Google Apps Script

---

## 📁 Estructura

- index.html
- styles.css
- app.js
- config.js

---

## ⚙️ Configuración

Editar config.js:

- URLs de Google Sheets
- WhatsApp
- API (Apps Script)
- PIN de caja

---

## 📊 Google Sheets

### DATA_ITEMS
Productos del menú

### DATA_EXTRAS
Toppings, bases, chocolates

Tipos importantes:
- Topping
- Base extra
- Jarabe
- Chocolate extra

---

## 🔄 Flujo

1. Carga CSV
2. Normaliza datos
3. Renderiza UI
4. Se actualiza automáticamente

---

## 🔥 Clave

renderExtras() debe ejecutarse después de renderAll()

---

## ⚠️ Problemas comunes

- No aparecen toppings → falta renderExtras()
- No actualiza → revisar publicación CSV
- No guarda → revisar Apps Script

---

## 📈 Escalabilidad

- Carrito real
- Backend (Spring Boot)
- Base de datos
- Autenticación

---

## 👨‍💻 Autor

Cristian Crisanto
