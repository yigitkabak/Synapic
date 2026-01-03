.PHONY: all frontend consus frontend-npm consus-npm dev

all: frontend consus

frontend-npm:
	@echo "Running npm install for frontend..."
	cd frontend && npm install

consus-npm:
	@echo "Running npm install for consus..."
	cd consus && npm install

dev:
	@echo "Starting both servers..."
	cd frontend && npm run serve & cd consus && npm run start

frontend:
	@echo "Starting frontend server..."
	cd frontend && npm run serve

consus:
	@echo "Starting consus server..."
	cd consus && npm run start
