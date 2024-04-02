/*
 * LightningChart JS example on geographical data visualization by laying a 2D heatmap over a picture of a map.
 */

// Import LightningChartJS
const lcjs = require('@arction/lcjs')
const xydata = require('@arction/xydata')

// Extract required parts from LightningChartJS.
const { lightningChart, regularColorSteps, ImageFill, ImageFitMode, PalettedFill, LUT, formatLongitudeLatitude, emptyLine, Themes } = lcjs

const { createWaterDropDataGenerator } = xydata

// Create a XY Chart
const chart = lightningChart({
    // Example data set is a bit larger than actual displayed heatmap. This is intentional, but displays a console warning.
    // This flag is specified to omit this warning.
    warnings: false,
})
    .ChartXY({
        theme: Themes[new URLSearchParams(window.location.search).get('theme') || 'darkGold'] || undefined,
    })
    .setTitle('Loading temperature data ...')
    .setPadding({ right: 40 })
    .setMouseInteractions(false)

const axisY = chart.getDefaultAxisY().setTitle('Latitude').setMouseInteractions(false).setAnimationScroll(false)
const axisX = chart.getDefaultAxisX().setTitle('Longitude').setMouseInteractions(false).setAnimationScroll(false)
const theme = chart.getTheme()

// Define value -> color look up table.
let legend
const setHeatmapPalette = (transparency) => {
    heatmap.setFillStyle(
        new PalettedFill({
            lut: new LUT({
                units: 'intensity',
                steps: regularColorSteps(0, 100, theme.examples.coldHotColorPalette, { alpha: transparency }),
                interpolate: true,
            }),
        }),
    )
    legend = legend || chart.addLegendBox().add(chart)
}

// Add Heatmap Series
const columns = 500
const rows = 320
const heatmap = chart
    .addHeatmapGridSeries({
        columns,
        rows,
        start: { x: -126, y: 24 },
        end: { x: -66, y: 48.0 },
        dataOrder: 'columns',
    })
    .setWireframeStyle(emptyLine)
    // Customize cursor result table formatting.
    .setCursorResultTableFormatter((builder, _, dataPoint) =>
        builder
            .addRow(formatLongitudeLatitude(dataPoint.x, dataPoint.y))
            .addRow('Temp:', '', fahrenheitToCelsius(dataPoint.intensity).toFixed(1), '\u00B0С'),
    )

// Get Temperature Data
fetch(new URL(document.head.baseURI).origin + new URL(document.head.baseURI).pathname + 'examples/assets/1110/usa-temperature-data.json')
    .then((r) => r.json())
    .then((temperatureData) => {
        // Add data to the Heatmap Series
        heatmap.invalidateIntensityValues(temperatureData.data)
        chart.setTitle('Loading animation ...')

        // Generate random offset data set for real-time animation.
        createWaterDropDataGenerator()
            .setColumns(columns)
            .setRows(rows)
            .setWaterDrops([
                { columnNormalized: 0.6, rowNormalized: 0.6, amplitude: 1 },
                { columnNormalized: 0.2, rowNormalized: 0.1, amplitude: 0.9 },
                { columnNormalized: 0.1, rowNormalized: 0.8, amplitude: 0.6 },
            ])
            .generate()
            .then((randomData) => {
                // Map random data to more realistic fahrenheit value range.
                return randomData.map((row) => row.map((fahrenheitOffset) => fahrenheitOffset * 0.4))
            })
            .then((randomData) => {
                chart.setTitle('Animated United States Temperature Heat map')

                // Generate n data sets that are interpolations between temperature data set and offset with random data.
                const animationSteps = 100
                const dataSets = []
                for (let i = 0; i < animationSteps; i += 1) {
                    // [0, 1]
                    const interpolation = i / (animationSteps - 1)
                    if (interpolation === 0) {
                        dataSets.push(temperatureData.data)
                    } else {
                        const interpolatedDataSet = []
                        for (let column = 0; column < columns; column += 1) {
                            const columnValues = []
                            interpolatedDataSet.push(columnValues)
                            for (let row = 0; row < rows; row += 1) {
                                columnValues.push(temperatureData.data[column][row] + interpolation * randomData[row][column])
                            }
                        }
                        dataSets.push(interpolatedDataSet)
                    }
                }

                // Animate continuous interpolation between temperature data set and offset with random data.
                let dAnimation = 0
                let tPrevAnimationUpdate = window.performance.now()
                let activeDataSetIndex = 0
                const animationDurationMs = 5000
                const updateAnimation = () => {
                    const tNow = window.performance.now()
                    const dDelta = tNow - tPrevAnimationUpdate
                    dAnimation += dDelta
                    // Calculate animation position as [0, 1] where 0 = exact temperature data and 1 = exact temperature + random data.
                    const a = dAnimation % animationDurationMs
                    const animationPosition =
                        a < animationDurationMs / 2
                            ? a / (animationDurationMs / 2)
                            : 1 - (a - animationDurationMs / 2) / (animationDurationMs / 2)

                    const dataSetIndex = Math.round(animationPosition * (dataSets.length - 1))
                    if (dataSetIndex !== activeDataSetIndex) {
                        activeDataSetIndex = dataSetIndex
                        // Change displayed heat map data set.
                        heatmap.invalidateIntensityValues(dataSets[dataSetIndex])
                    }

                    tPrevAnimationUpdate = tNow
                    requestAnimationFrame(updateAnimation)
                }
                updateAnimation()
            })
    })

// Load picture of USA map.
const bgImg = new Image()
bgImg.crossOrigin = ''
bgImg.src =
    new URL(document.head.baseURI).origin +
    new URL(document.head.baseURI).pathname +
    `examples/assets/1110/${theme.isDark ? 'usa.png' : 'usa-light.png'}`

// Style Chart series background as the picture.
chart.setSeriesBackgroundFillStyle(
    new ImageFill({
        source: bgImg,
        fitMode: ImageFitMode.Stretch,
    }),
)

// Utility function for converting Fahrenheit to Celsius
const fahrenheitToCelsius = (celsius) => {
    return (celsius - 32) * (5 / 9)
}

// Maintain static aspect ratio of series area.
// Size of X and Y axes is configured manually here to know the exact size distribution of the chart.
const leftAxisSizePx = 80
const bottomAxisSizePx = 60
axisX.setThickness(bottomAxisSizePx)
axisY.setThickness(leftAxisSizePx)

const updateChartAspectRatio = () => {
    const chartBounds = chart.engine.container.getBoundingClientRect()
    const seriesAreaSizePx = {
        x: Math.ceil(chartBounds.width - leftAxisSizePx),
        y: Math.ceil(chartBounds.height - bottomAxisSizePx),
    }

    // height / width
    const mapAspectRatio = 883 / 1600
    const curAspectRatio = seriesAreaSizePx.y / seriesAreaSizePx.x

    if (curAspectRatio < mapAspectRatio) {
        // Add horizontal chart padding to maintain Map picture aspect ratio.
        const targetAxisWidth = seriesAreaSizePx.y / mapAspectRatio
        const horizontalPadding = Math.max(seriesAreaSizePx.x - targetAxisWidth, 0)
        chart.setPadding({ left: horizontalPadding / 2, right: horizontalPadding / 2, top: 0, bottom: 0 })
    } else if (curAspectRatio > mapAspectRatio) {
        // Add vertical chart padding to maintain Map picture aspect ratio.
        const targetAxisHeight = seriesAreaSizePx.x * mapAspectRatio
        const verticalPadding = Math.max(seriesAreaSizePx.y - targetAxisHeight, 0)
        chart.setPadding({ top: verticalPadding / 2, bottom: verticalPadding / 2, left: 0, right: 16 })
    }
}
updateChartAspectRatio()

// Maintain chart aspect ratio when window is resized.
window.addEventListener('resize', updateChartAspectRatio)

// Add slider user interface for adjusting heat map transparency.
const exampleContainer = document.getElementById('chart') || document.body
const uiDiv = document.createElement('div')
chart.engine.container.append(uiDiv)
uiDiv.style.position = 'absolute'
uiDiv.style.left = '6px'
uiDiv.style.bottom = '6px'
uiDiv.style.zIndex = '999'
uiDiv.style.color = 'white'
uiDiv.style.display = 'flex'
uiDiv.style.flexDirection = 'row'
uiDiv.style.color =
    (exampleContainer.parentElement.parentElement && window.getComputedStyle(exampleContainer.parentElement.parentElement).color) || 'white'
const label = document.createElement('span')
uiDiv.append(label)
label.innerHTML = 'Heat map transparency'
const slider = document.createElement('input')
uiDiv.append(slider)
slider.type = 'range'
slider.min = 0
slider.max = 255
slider.value = 150
setHeatmapPalette(slider.value)
slider.oninput = (e) => setHeatmapPalette(slider.value)
