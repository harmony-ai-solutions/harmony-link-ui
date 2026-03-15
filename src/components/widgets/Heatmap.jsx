import React from 'react';
import Plot from 'react-plotly.js';

// Function to decode base64-encoded binary data to a numeric array for visualization.
// If the byte length is divisible by 4, interpret as little-endian float32 values.
// Otherwise (e.g. torch.save blobs from Chatterbox), interpret each byte as a uint8
// value normalized to [0, 1] so any binary embedding can still be visualized.
function base64ToNumericArray(base64) {
    // Decode base64 string to binary string
    const binaryString = atob(base64);

    // Create a Uint8Array from the binary string
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Use Float32Array when byte-aligned, otherwise fall back to normalized uint8
    if (len % 4 === 0) {
        return new Float32Array(bytes.buffer);
    } else {
        // Normalize uint8 values [0..255] → [0..1] for uniform heatmap rendering
        const normalized = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            normalized[i] = bytes[i] / 255.0;
        }
        return normalized;
    }
}

const Heatmap = ({ data, title = '', colorRange = [0, 0.3] }) => {
    // Decode and process the data
    const embedArray = base64ToNumericArray(data);

    // Reshape the data if necessary
    const height = Math.floor(Math.sqrt(embedArray.length));
    const width = height;

    const zData = [];
    for (let i = 0; i < height; i++) {
        zData.push(embedArray.slice(i * width, (i + 1) * width));
    }

    return (
        <Plot
            data={[
                {
                    z: zData,
                    type: 'heatmap',
                    colorscale: 'Viridis',
                    zmin: colorRange[0],
                    zmax: colorRange[1],
                    showscale: false,
                    colorbar: {
                        thickness: 10,
                    },
                },
            ]}
            layout={{
                title: title,
                xaxis: {
                    showticklabels: false,
                },
                yaxis: {
                    showticklabels: false,
                },
                margin: {
                    l: 0,
                    r: 0,
                    t: 0,
                    b: 0,
                },
            }}
            config={{
                responsive: false,
                staticPlot: true,
            }}
            style={{ width: '100%', height: '100%' }}
        />
    );
};

export default Heatmap;
