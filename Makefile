.PHONY: all frontend backend frontend-npm backend-npm dev

all: frontend backend

frontend-npm:
	@echo "Running npm install for frontend..."
	cd frontend && npm install

backend-npm:
	@echo "Running npm install for backend..."
	cd backend && npm install

dev:
	@echo "Starting both servers..."
	cd frontend && npm run serve & cd backend && npm run start

frontend:
	@echo "Starting frontend server..."
	cd frontend && npm run serve

backend:
	@echo "Starting backend server..."
	cd backend && npm run serve
