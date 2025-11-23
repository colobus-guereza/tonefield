from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import numpy as np

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Tone Field Physics Engine Ready"}

@app.get("/api/field")
def get_field(
    tension: float = Query(..., description="Tension value (0.0 to 1.0). Higher means tighter/flatter."),
    frequency: float = Query(..., description="Frequency of the wave.")
):
    """
    Generates a 50x50 2D grid representing the tone field.
    Returns Z-values based on tension and frequency.
    """
    # Grid configuration
    size = 50
    x = np.linspace(-1, 1, size)
    y = np.linspace(-1, 1, size)
    X, Y = np.meshgrid(x, y)
    
    # Calculate distance from center (radius)
    R = np.sqrt(X**2 + Y**2)
    
    # Physics Logic:
    # Tension (0.0 - 1.0) affects Amplitude.
    # High tension -> Low amplitude (flat)
    # Low tension -> High amplitude (wavy)
    # Let's map tension 0.0 -> Amp 1.0, Tension 1.0 -> Amp 0.1 (or 0.0)
    amplitude = 1.0 - (tension * 0.9) # Never completely 0 to keep it interesting, or maybe 1-tension is fine.
    
    # Wave function: Z = A * sin(freq * R - phase)
    # We'll just use a static wave for now, maybe add time later if needed.
    # Using cos for a peak at center, or sin for a node. 
    # "Spread from center" -> usually cos(k*r) or similar.
    Z = amplitude * np.cos(frequency * R * np.pi)
    
    # Convert to list for JSON serialization
    # Flatten to 1D array for easier consumption by Three.js PlaneGeometry
    return {
        "z_values": Z.flatten().tolist(),
        "size": size,
        "tension": tension,
        "frequency": frequency
    }
