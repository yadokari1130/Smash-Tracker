import {Fragment, useState} from "react"
import {useStorage} from "@plasmohq/storage/hook"
import {Storage} from "@plasmohq/storage"
import {
    AccordionDetails,
    AccordionSummary,
    Autocomplete,
    Backdrop,
    Box,
    Button,
    CircularProgress,
    Container,
    Grid,
    Accordion,
    TextField,
    Typography,
    TableBody,
    TableRow,
    TableCell,
    Table,
    Tab,
    Tabs,
    styled,
    Snackbar,
    Alert, AlertTitle
} from "@mui/material"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import axios from "axios";
import "./font.css"

const urlRegex = new RegExp("(?:https://)?(?:www\\.)?start\\.gg/tournament/([^/]*)/event/([^/]*)/?.*/?$")
const StripeTableRow = styled(TableRow)(({ theme }) => ({
    '&:nth-of-type(odd)': {
        backgroundColor: theme.palette.action.hover,
    }
}))
interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}
function TabPanel(props: TabPanelProps) {
    const {children, value, index, ...other } = props

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
        >
            {value === index && (
                <Box sx={{p: 0, mt: 4}}>
                    {children}
                </Box>
            )}
        </div>
    )
}

async function getEventInfo(tournamentName, eventName, apiKey) {
    return axios.post("https://api.start.gg/gql/alpha",{
        query: `
            query TournamentQuery($tournamentName: String!, $eventName: String!) {
                tournament(slug: $tournamentName) {
                    id
                    name
                    events(filter: {slug: $eventName}){
                        id
                        name
                        numEntrants
                        phases {
                            id
                            name
                        }
                    }
                }
            }
        `,
        variables: {tournamentName: tournamentName, eventName: eventName}
    }, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        }
    })
}

async function getPlayers(eventId, page, apiKey) {
    return axios.post("https://api.start.gg/gql/alpha",{
        query: `
            query EventPlayers($eventId: ID!, $page: Int!, $perPage: Int!) {
                event(id: $eventId) {
                    entrants(query: {page: $page, perPage: $perPage}) {
                        pageInfo {
                            total
                            totalPages
                        }
                        nodes {
                            participants {
                                player {
                                    id
                                }
                            }
                            id
                            name
                        }
                    }
                }
            }
        `,
        variables: {eventId: eventId, page: page, perPage: 450}
    }, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        }
    })
}

function getRecentStandings(playerId, apiKey) {
    return axios.post("https://api.start.gg/gql/alpha",{
        query: `
                query RecentStandings($playerId: ID!, $videogameId: ID!, $limit: Int!) {
                    player(id: $playerId) {
                        recentStandings(videogameId: $videogameId, limit: $limit) {
                            container {
                            ... on Event {
                                    name
                                    numEntrants
                                    tournament {
                                        name
                                    }
                                    startAt
                                }
                            }
                            placement
                        },
                        user {
                            location {
                                country
                            }
                        }
                    }
                }
            `,
        variables: {playerId: playerId, videogameId: 1386, limit: 10}
    }, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        }
    })
}

function getHeadToHead(p1Id, p2Id, apiKey) {
    return new Promise<number[]>(async resolve => {
        let tp = 1
        let result = [0, 0]
        for (let i = 1; i <= tp; i++) {
            await getAllSets(p1Id, i, apiKey)
                .then(res => {
                    tp = res.data.player.sets.pageInfo.totalPages

                    for (let node of res.data.player.sets.nodes) {
                        if (node.slots[0].entrant.participants.length === 1 && node.slots[0].entrant.participants[0].player.id === p2Id) {
                            if (node.winnerId === node.slots[0].entrant.id) result[1]++
                            else result[0]++
                        }
                        if (node.slots[1].entrant.participants.length === 1 && node.slots[1].entrant.participants[0].player.id === p2Id) {
                            if (node.winnerId === node.slots[1].entrant.id) result[1]++
                            else result[0]++
                        }
                    }
                })
        }

        resolve(result)
    })
}

function filteringH2H(res, p2Id, reverse) {
    let ids = []
    let result = [0, 0]

    for (let node of res.data.player.sets.nodes) {
        if (node.slots.length !== 2) continue
        if (!node.slots[0].entrant || !node.slots[1].entrant) continue
        if (node.slots[0].entrant.participants.length === 1 && node.slots[0].entrant.participants[0].player.id === p2Id) {
            ids.push({setId: node.id, mainId: node.slots[reverse ? 0 : 1].entrant.id})
            if (node.winnerId === node.slots[0].entrant.id) result[1]++
            else result[0]++
        }
        if (node.slots[1].entrant.participants.length === 1 && node.slots[1].entrant.participants[0].player.id === p2Id) {
            ids.push({setId: node.id, mainId: node.slots[reverse ? 1 : 0].entrant.id})
            if (node.winnerId === node.slots[1].entrant.id) result[1]++
            else result[0]++
        }
    }

    if (reverse) result = [result[1], result[0]]
    return [result, ids]
}

function getAllSets(playerId, page, apiKey) {
    return axios.post("https://api.start.gg/gql/alpha",{
        query: `
                query Sets($playerId: ID!, $perPage: Int!, $page: Int!) {
                    player(id: $playerId) {
                        sets(perPage: $perPage, page: $page, filters: {isEventOnline: false}) {
                            pageInfo {
                                page
                                totalPages
                            }
                            nodes {
                                id
                                winnerId
                                slots {
                                    entrant {
                                        id
                                        participants {
                                            player {
                                                id
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `,
        variables: {playerId: playerId, perPage: 100, page: page}
    }, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        }
    })
}

function getCurrentStanding(playerName, eventId, playerId, apiKey) {
    return axios.post("https://api.start.gg/gql/alpha",{
        query: `
                query CurrentStanding($playerName: String!, $eventId: ID!, $playerId: ID!) {
                    event(id: $eventId) {
                        entrants(query: {page: 1, perPage: 500, filter: {name: $playerName}}) {
                            nodes {
                                initialSeedNum
                                participants {
                                    player {
                                        id
                                    }
                                }
                                standing {
                                    placement
                                }
                            }
                        }
                        sets (filters: {playerIds: [$playerId]}, sortType: RECENT) {
                            nodes {
                                displayScore
                                fullRoundText
                                phaseGroup {
                                    displayIdentifier
                                }
                            }
                        }
                    }
                }
            `,
        variables: {playerName: playerName, eventId: eventId, playerId: playerId}
    }, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        }
    })
}

function getSets(ids, apiKey) {
    return axios.post("https://api.start.gg/gql/alpha",{
        query: `
                query Set1 {
                    ${ids.map((e, i) => {
                        return `
                            s${i}: set(id: ${e.setId}) {
                                winnerId
                                displayScore(mainEntrantId: ${e.mainId})
                                event {
                                    name
                                    tournament {
                                        name
                                    }
                                    startAt
                                }
                            }
                        `
                    })}
                }
            `
    }, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        }
    })
}

function errorContent(message, errorLog) {
    return (
        <Fragment>
            <p style={{margin: 0, padding: 0}}>{message}</p>
            <p style={{margin: 0, padding: 0}}>{errorLog}</p>
        </Fragment>
    )
}

function IndexPopup() {
    const storage = new Storage()
    const [url, setUrl] = useState("")
    const [apiKey, setApiKey] = useState("")
    storage.get("url").then(u => setUrl(u))
    storage.get("apiKey").then(k => setApiKey(k))
    const [playerList, setPlayerList] = useStorage({
        key: "playerList",
        instance: new Storage({
            area: "local"
        })
    }, [])
    const [tournamentName, setTournamentName] = useStorage({
        key: "tournamentName",
        instance: new Storage({
            area: "local"
        })
    }, "")
    const [eventName, setEventName] = useStorage({
        key: "eventName",
        instance: new Storage({
            area: "local"
        })
    }, "")
    const [tournamentId, setTournamentId] = useStorage({
        key: "tournamentId",
        instance: new Storage({
            area: "local"
        })
    }, 0)
    const [eventId, setEventId] = useStorage({
        key: "eventId",
        instance: new Storage({
            area: "local"
        })
    }, 0)
    const [playerInfo, setPlayerInfo] = useStorage({
        key: "playerInfo",
        instance: new Storage({
            area: "local"
        })
    }, {})
    const [player, setPlayer] = useStorage({
        key: "player",
        instance: new Storage({
            area: "local"
        })
    }, null)
    const [player1, setPlayer1] = useStorage({
        key: "player1",
        instance: new Storage({
            area: "local"
        })
    }, null)
    const [player2, setPlayer2] = useStorage({
        key: "player2",
        instance: new Storage({
            area: "local"
        })
    }, null)
    const [headToHead, setHeadToHead] = useStorage({
        key: "headToHead",
        instance: new Storage({
            area: "local"
        })
    }, [])
    const [numEntrants, setNumEntrants] = useStorage({
        key: "numEntrants",
        instance: new Storage({
            area: "local"
        })
    }, 0)
    const [headToHeadList, setHeadToHeadList] = useStorage({
        key: "headToHeadList",
        instance: new Storage({
            area: "local"
        })
    }, [])
    const [tabValue, setTabValue] = useStorage({
        key: "tabValue",
        instance: new Storage({
            area: "local"
        })
    }, 0)
    // const [player1, setPlayer1] = useState(null)
    // const [player2, setPlayer2] = useState(null)
    const [temp, setTemp] = useState("")
    const [urlError, setUrlError] = useState(false)
    const [isFetching, setIsFetching] = useState(false)
    const [fetchingPlayer, setFetchingPlayer] = useState(0)
    // const [player1Info, setPlayer1Info] = useState({})
    // const [player2Info, setPlayer2Info] = useState({})
    const [isFetchingH2HInfo, setIsFetchingH2HInfo] = useState(false)
    const [isFetchingPlayerInfo, setIsFetchingPlayerInfo] = useState(false)
    const [snackbarOpen, setSnackbarOpen] = useState(false)
    const [snackbarMessage, setSnackbarMessage] = useState(null)

    return (
        <div className="main" style={{width: "700px", height: "600px"}}>
            <Container component="main" sx={{p: 2}}>
                <Grid spacing={3} container sx={{justifyContent: "space-between", pb: 2}}>
                    <Grid xs={12} item>
                        <TextField
                            label="APIキー"
                            variant="outlined"
                            helperText="https://dev.start.gg/docs/authentication/ このサイトを参考にAPIキーを取得してください"
                            fullWidth
                            onChange={e => {
                                setApiKey(e.target.value)
                                storage.set("apiKey", e.target.value)
                            }}
                            value={apiKey}
                            size="small"
                        />
                    </Grid>
                    <Grid xs={10} item>
                        <TextField
                            label="大会URL"
                            variant="outlined"
                            helperText={urlError ? "有効なURLを設定してください" : "例：https://www.start.gg/tournament/10-kagaribi-10/event/singles"}
                            fullWidth
                            onChange={e => {
                                if (urlError) setUrlError(false)
                                setUrl(e.target.value)
                                storage.set("url", e.target.value)
                            }}
                            value={url}
                            size="small"
                            error={urlError}
                        />
                    </Grid>
                    <Grid xs={2} item>
                        <Button
                            variant="outlined"
                            sx={{width: "100%"}}
                            onClick={async e => {
                                setUrlError(false)
                                setTemp("")
                                const result = urlRegex.exec(url)
                                if (result == null) {
                                    setUrlError(true)
                                    return
                                }

                                setIsFetching(true)

                                try {
                                    let res = (await getEventInfo(result[1], result[2], apiKey)).data
                                    // setTemp(JSON.stringify(res))
                                    if (res.data.tournament == null || res.data.tournament.events.length === 0) setUrlError(true)
                                    else {
                                        setTournamentName(res.data.tournament.name)
                                        setTournamentId(res.data.tournament.id)
                                        setEventName(res.data.tournament.events[0].name)
                                        setEventId(res.data.tournament.events[0].id)
                                        setNumEntrants(res.data.tournament.events[0].numEntrants)
                                        setFetchingPlayer(0.0000000000001)

                                        let eventId = res.data.tournament.events[0].id
                                        let players = []
                                        let tp = 1
                                        let fp = 0
                                        setPlayerList([])
                                        for (let i = 1; i <= tp; i++) {
                                            let res = (await getPlayers(eventId, i, apiKey)).data

                                            tp = res.data.event.entrants.pageInfo.totalPages
                                            for (let node of res.data.event.entrants.nodes) {
                                                if (players.includes({id: node.participants[0].player.id, label: node.name})) continue
                                                players.push({id: node.participants[0].player.id, label: node.name})
                                            }
                                            fp += res.data.event.entrants.nodes.length
                                            setFetchingPlayer(fp)
                                        }
                                        setPlayerList(players)
                                        setPlayerInfo({})
                                        setHeadToHead(null)
                                        setHeadToHeadList(null)
                                        setPlayer(null)
                                        setPlayer1(null)
                                        setPlayer2(null)

                                        await new Promise(resolve => setTimeout(resolve, 100))
                                    }
                                } catch (e) {
                                    setSnackbarOpen(true)

                                    if (e.response && e.response.status == 429) setSnackbarMessage(errorContent("しばらく時間を空け、もう一度お試しください", ""))
                                    else if (e.response) setSnackbarMessage(errorContent("APIキーなどを確認してください", `${e.response.data.message} (${e.response.status})`))
                                    else if (e.message) setSnackbarMessage(errorContent("", e.message))
                                } finally {
                                    setIsFetching(false)
                                    await new Promise(resolve => setTimeout(resolve, 100))
                                    setFetchingPlayer(0)
                                }
                            }}>
                            設定
                        </Button>
                        <Backdrop
                            sx={{zIndex: theme => theme.zIndex.drawer + 1}}
                            open={(isFetching || isFetchingPlayerInfo || isFetchingH2HInfo)}
                        >
                            <CircularProgress
                                variant={fetchingPlayer === 0 ? "indeterminate" : "determinate"}
                                value={fetchingPlayer / numEntrants * 100}
                                size="75px"
                                color="primary"
                            />
                            <Box
                                sx={{
                                    top: 0,
                                    left: 0,
                                    bottom: 0,
                                    right: 0,
                                    position: "absolute",
                                    display: fetchingPlayer === 0 ? "none" : "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Typography
                                    component="div"
                                    color="black"
                                >
                                    {`${Math.round(fetchingPlayer / numEntrants * 100)}%`}
                                </Typography>
                            </Box>
                        </Backdrop>
                    </Grid>
                </Grid>

                <Grid spacing={3} container sx={{pb: 4}}>
                    <Grid item xs={6}>
                        <Typography variant="subtitle1" align="center">大会名</Typography>
                        <Typography variant="subtitle1" align="center">{tournamentName}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="subtitle1" align="center">イベント名</Typography>
                        <Typography variant="subtitle1" align="center">{eventName}</Typography>

                    </Grid>
                </Grid>

                <Box sx={{borderBottom: 1, borderColor: "divider"}}>
                    <Tabs
                        value={tabValue}
                        onChange={(e, newValue) => setTabValue(newValue)}
                        variant="fullWidth"
                    >
                        <Tab label="戦績確認"/>
                        <Tab label="直対比較"/>
                    </Tabs>
                </Box>

                <TabPanel index={0} value={tabValue}>
                    <Autocomplete
                        renderInput={params => <TextField label="選手" {...params}/>}
                        renderOption={(props, option) => <Box component="li" {...props}
                                                              key={option.id}>{option.label}</Box>}
                        options={playerList}
                        onChange={async (e, value) => {
                            setPlayer(value)
                            if (value == null) return
                            setIsFetchingPlayerInfo(true)
                            // getAllSets(value.id, 1).then(res => setTemp(JSON.stringify(res)))

                            let pInfo = JSON.parse(JSON.stringify(playerInfo))
                            if (!(value.id in pInfo)) pInfo[value.id] = {}

                            try {
                                let res = (await getCurrentStanding(value.label, eventId, value.id, apiKey)).data
                                // console.log(JSON.stringify(res))
                                // await new Promise(resolve => setTimeout(resolve, 5000))
                                for (let node of res.data.event.entrants.nodes) {
                                    // setTemp(`${node.participants[0].player.id} ${value.id} ${node.participants[0].player.id === value.id} ${node.standing.placement}`)
                                    if (node.participants[0].player.id === value.id) {
                                        pInfo[value.id].currentStanding = node.standing.placement
                                        pInfo[value.id].seed = node.initialSeedNum
                                        break
                                    }
                                }

                                pInfo[value.id].sets = []
                                for (let node of res.data.event.sets.nodes) {
                                    const re = new RegExp(`(.+? [0-9]+?) - (${value.label} [0-9]+?)`)
                                    const matched = re.exec(node.displayScore)
                                    const score = matched == null ? node.displayScore : `${matched[2]} - ${matched[1]}`
                                    pInfo[value.id].sets.push({score: score, round: node.fullRoundText, phaseId: node.phaseGroup.displayIdentifier})
                                }

                                if (!("recentStandings" in pInfo[value.id])) {
                                    let res = (await getRecentStandings(value.id, apiKey)).data
                                    pInfo[value.id].recentStandings = res.data.player.recentStandings
                                }

                                await setPlayerInfo(pInfo)
                            } finally {
                                setIsFetchingPlayerInfo(false)
                            }
                        }}
                        size="small"
                        value={player}
                        sx={{mb: 2}}
                    />
                    {/*<p>{player1 && JSON.stringify(playerInfo[player1.id])}</p>*/}
                    {/*<p>{player1 && player1.id}</p>*/}
                    {/*<p>{`${JSON.stringify(player1)} ${player1.id in seeds} ${player1.id in playerInfo} ${"recentStandings" in playerInfo[player1.id]} ${"currentStanding" in playerInfo[player1.id]} aaa`}</p>*/}
                    {player && player.id in playerInfo &&
                        "recentStandings" in playerInfo[player.id] && "currentStanding" in playerInfo[player.id] &&
                        <div>
                            <Accordion disableGutters>
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon/>}><Typography>大会情報</Typography></AccordionSummary>
                                <AccordionDetails>
                                    <Table>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell>現在の順位</TableCell>
                                                <TableCell align="right">{playerInfo[player.id].currentStanding}位
                                                    / {numEntrants}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>シード</TableCell>
                                                <TableCell align="right">{playerInfo[player.id].seed}位
                                                    / {numEntrants}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>

                                    <Typography sx={{mx: 2, mt: 3, mb: 0}}>対戦履歴</Typography>
                                    <Table>
                                        <TableBody>
                                            {playerInfo[player.id].sets.map(s => {
                                                return <TableRow>
                                                    <TableCell>{s.phaseId} - {s.round}</TableCell>
                                                    <TableCell>{s.score}</TableCell>
                                                </TableRow>
                                            })}
                                        </TableBody>
                                    </Table>

                                    {/*<p>{JSON.stringify(playerInfo[player.id].sets)}</p>*/}
                                </AccordionDetails>
                            </Accordion>
                            <Accordion disableGutters>
                                <AccordionSummary expandIcon={
                                    <ExpandMoreIcon/>}><Typography>直近の戦績</Typography></AccordionSummary>
                                <AccordionDetails>
                                    <Table>
                                        <TableBody>
                                            {(playerInfo[player.id]["recentStandings"] || []).map((e, i) => {
                                                return <Fragment>
                                                    <StripeTableRow>
                                                        <TableCell>
                                                            <div>{e.container.tournament.name}</div>
                                                            <div>{e.container.name}</div>
                                                        </TableCell>
                                                        <TableCell>{new Date(e.container.startAt * 1000).toLocaleDateString("ja-JP")}</TableCell>
                                                        <TableCell sx={e.placement <= 8 ? {
                                                            color: "red",
                                                            width: "100px"
                                                        } : {width: "100px"}}>
                                                            <Grid spacing={1} container justifyContent="space-around">
                                                                <Grid item xs={6}
                                                                      textAlign="right">{e.placement}位</Grid>
                                                                <Grid item xs={1}>/</Grid>
                                                                <Grid item xs={5}
                                                                      textAlign="right">{e.container.numEntrants}</Grid>
                                                            </Grid>
                                                            {/*<span>{e.placement}位 / {e.container.numEntrants}</span>*/}
                                                        </TableCell>
                                                        {/*<TableCell align="center">*/}
                                                        {/*    <Typography variant="h6" sx={e.placement <= 8 ? {color: "red"} : {}}>*/}
                                                        {/*        /!*<Grid spacing={0} container*!/*/}
                                                        {/*        /!*      justifyContent="center"*!/*/}
                                                        {/*        /!*      sx={e.placement <= 8 ? {*!/*/}
                                                        {/*        /!*          color: "red",*!/*/}
                                                        {/*        /!*      } : {}}>*!/*/}
                                                        {/*        /!*    <Grid item xs={1}*!/*/}
                                                        {/*        /!*          textAlign="right">{e.placement}位</Grid>*!/*/}
                                                        {/*        /!*    <Grid item xs={1}>/</Grid>*!/*/}
                                                        {/*        /!*    <Grid item xs={1}*!/*/}
                                                        {/*        /!*          textAlign="right">{e.container.numEntrants}</Grid>*!/*/}
                                                        {/*        /!*</Grid>*!/*/}
                                                        {/*        {e.placement}位 / {e.container.numEntrants}*/}
                                                        {/*    </Typography>*/}
                                                        {/*    <div>{e.container.tournament.name} - {e.container.name} ({new Date(e.container.startAt * 1000).toLocaleDateString("ja-JP")})</div>*/}
                                                        {/*</TableCell>*/}
                                                    </StripeTableRow>
                                                </Fragment>
                                            })}
                                        </TableBody>
                                    </Table>
                                </AccordionDetails>
                            </Accordion>
                        </div>
                    }
                    {/*{isFetchingPlayerInfo &&*/}
                    {/*    <Grid*/}
                    {/*        container*/}
                    {/*        justifyContent="center"*/}
                    {/*        sx={{mt: "30px"}}*/}
                    {/*    >*/}
                    {/*        <CircularProgress*/}
                    {/*            variant="indeterminate"*/}
                    {/*            size="30px"*/}
                    {/*            color="primary"*/}
                    {/*        />*/}
                    {/*    </Grid>*/}
                    {/*}*/}
                </TabPanel>
                <TabPanel index={1} value={tabValue}>
                    <Grid spacing={3} container>
                        <Grid item xs={6}>
                            <Autocomplete
                                renderInput={params => <TextField label="選手1" {...params}/>}
                                renderOption={(props, option) => <Box component="li" {...props}
                                                                      key={option.id}>{option.label}</Box>}
                                options={playerList}
                                onChange={(e, newValue) => setPlayer1(newValue)}
                                size="small"
                                value={player1}
                                sx={{mb: 2}}
                            />
                            {/*{player1 &&*/}
                            {/*    <p>{player1.id}</p>*/}
                            {/*}*/}
                        </Grid>
                        <Grid item xs={6}>
                            <Autocomplete
                                renderInput={params => <TextField label="選手2" {...params}/>}
                                renderOption={(props, option) => <Box component="li" {...props}
                                                                      key={option.id}>{option.label}</Box>}
                                options={playerList}
                                onChange={(e, newValue) => setPlayer2(newValue)}
                                size="small"
                                value={player2}
                                sx={{mb: 2}}
                            />
                            {/*{player2 &&*/}
                            {/*    <p>{player2.id}</p>*/}
                            {/*}*/}
                        </Grid>
                    </Grid>

                    {/*<p>{temp}</p>*/}
                    {/*<p>{isFetchingH2HInfo + ""}</p>*/}
                    <Button
                        variant="outlined"
                        sx={{width: "100%"}}
                        onClick={async e => {
                            if (!player1 || !player2) return
                            let pId = Math.max(player1.id, player2.id)
                            let pId2 = Math.min(player1.id, player2.id)
                            let reverse = player1.id < player2.id
                            setIsFetchingH2HInfo(true)
                            // setTemp(JSON.stringify(playerInfo) + "a")
                            // setTemp("a")
                            if (pId in playerInfo && "sets" in playerInfo[pId]) {
                                let h2h = [0, 0]
                                let ids = []
                                for (let s of playerInfo[pId].sets) {
                                    let [result, ids_] = filteringH2H(s, pId2, reverse)
                                    h2h[0] += result[0]
                                    h2h[1] += result[1]
                                    ids.push(...ids_)
                                }

                                setTemp("")

                                try {
                                    let res = (await getSets(ids, apiKey)).data
                                    // setTemp(JSON.stringify(res))
                                    let h2hList = []
                                    for (let i = 0; i < ids.length; i++) {
                                        let h = {}
                                        h["score"] = res.data[`s${i}`].displayScore
                                        h["tournament"] = `${res.data[`s${i}`].event.tournament.name} - ${res.data[`s${i}`].event.name}`
                                        h["startAt"] = res.data[`s${i}`].event.startAt
                                        h2hList.push(h)
                                    }

                                    await setHeadToHeadList(h2hList)
                                } catch (e) {
                                    setSnackbarOpen(true)

                                    if (e.response && e.response.status == 429) setSnackbarMessage(errorContent("しばらく時間を空け、もう一度お試しください", ""))
                                    else if (e.response) setSnackbarMessage(errorContent("APIキーなどを確認してください", `${e.response.data.message} (${e.response.status})`))
                                    else if (e.message) setSnackbarMessage(errorContent("", e.message))
                                } finally {
                                    setIsFetchingH2HInfo(false)
                                }

                                await setHeadToHead(h2h)
                                return
                            }

                            setTemp("aaaa")
                            try {
                                let tp = 1
                                let h2h = [0, 0]
                                let sets = []

                                let res = (await getAllSets(pId, 1, apiKey)).data
                                sets.push(res)

                                // setTemp(JSON.stringify(res))
                                tp = res.data.player.sets.pageInfo.totalPages
                                let ids = []
                                let [result, ids_] = filteringH2H(res, pId2, reverse)
                                ids.push(...ids_)
                                h2h[0] += result[0]
                                h2h[1] += result[1]

                                let requests = []
                                for (let i = 2; i <= tp; i++) {
                                    requests.push(getAllSets(pId, i, apiKey))
                                }

                                let results = await Promise.all(requests)
                                for (let r of results) {
                                    let res = r.data

                                    // setTemp(JSON.stringify(res))
                                    sets.push(res)
                                    // setTemp(JSON.stringify(sets))
                                    let [result, ids_] = filteringH2H(res, pId2, reverse)
                                    ids.push(...ids_)
                                    h2h[0] += result[0]
                                    h2h[1] += result[1]
                                }


                                // for (let i = 1; i <= tp; i++) {
                                //     let res = (await getAllSets(player1.id, i, apiKey)).data
                                //
                                //     setTemp(JSON.stringify(res))
                                //     let result = filteringH2H(res, player2.id)
                                //     h2h[1] += result[1]
                                // }

                                setTemp("cccc")
                                res = (await getSets(ids, apiKey)).data
                                setTemp(JSON.stringify(res))
                                let h2hList = []
                                for (let i = 0; i < ids.length; i++) {
                                    let h = {}
                                    h["score"] = res.data[`s${i}`].displayScore
                                    h["tournament"] = `${res.data[`s${i}`].event.tournament.name} - ${res.data[`s${i}`].event.name}`
                                    h["startAt"] = res.data[`s${i}`].event.startAt
                                    h2hList.push(h)
                                }

                                await setHeadToHeadList(h2hList)

                                let pInfo = JSON.parse(JSON.stringify(playerInfo))
                                if (!(pId in pInfo)) pInfo[pId] = {}
                                pInfo[pId].sets = sets
                                await setHeadToHead(h2h)
                                await setPlayerInfo(pInfo)
                            } catch (e) {
                                setSnackbarOpen(true)

                                if (e.response && e.response.status == 429) setSnackbarMessage(errorContent("しばらく時間を空け、もう一度お試しください", ""))
                                else if (e.response) setSnackbarMessage(errorContent("APIキーなどを確認してください", `${e.response.data.message} (${e.response.status})`))
                                else if (e.message) setSnackbarMessage(errorContent("", e.message))
                            } finally {
                                setIsFetchingH2HInfo(false)
                            }
                        }}>
                        比較
                    </Button>

                    {/*<p>{temp}</p>*/}

                    {/*<p>{JSON.stringify(headToHead)}</p>*/}
                    {headToHead &&
                        <Grid container justifyContent="center" sx={{mt: 3}}>
                            <Grid item xs={1}><Typography variant="h6" align="right">{headToHead[0]}</Typography></Grid>
                            <Grid item xs={1}><Typography variant="h6" align="center">-</Typography></Grid>
                            <Grid item xs={1}><Typography variant="h6" align="left">{headToHead[1]}</Typography></Grid>
                        </Grid>
                    }
                    {headToHeadList &&
                        <Table sx={{mt: 3}}>
                            <TableBody>
                                {headToHeadList.map(e => {
                                    return <Fragment>
                                        <StripeTableRow>
                                            <TableCell align={"center"}>
                                                <div>
                                                    <Typography variant="h6">{e.score}</Typography>
                                                </div>
                                                <div>{e.tournament} ({new Date(e.startAt * 1000).toLocaleDateString("ja-JP")})</div>
                                            </TableCell>
                                        </StripeTableRow>
                                    </Fragment>
                                })}
                            </TableBody>
                        </Table>
                        // headToHeadList.map(e => {
                        //     return <div>
                        //         <p>{e.score}</p>
                        //         <p>{e.tournament}</p>
                        //     </div>
                    }
                    {/*<Typography variant="subtitle1">{headToHead[0]} - {headToHead[1]}</Typography>*/}
                    {/*<p>{temp}</p>*/}

                    {/*{isFetchingH2HInfo &&*/}
                    {/*    <Grid*/}
                    {/*        container*/}
                    {/*        justifyContent="center"*/}
                    {/*        sx={{mt: "30px"}}*/}
                    {/*    >*/}
                    {/*        <CircularProgress*/}
                    {/*            variant="indeterminate"*/}
                    {/*            size="30px"*/}
                    {/*            color="primary"*/}
                    {/*        />*/}
                    {/*    </Grid>*/}
                    {/*}*/}
                </TabPanel>

                <Snackbar
                    open={snackbarOpen}
                    autoHideDuration={6000}
                    onClose={e => setSnackbarOpen(false)}
                    anchorOrigin={{vertical: "bottom", horizontal: "center"}}
                >
                    <Alert onClose={e => setSnackbarOpen(false)} severity="error" sx={{width: "100%"}}>
                        <AlertTitle>エラーが発生しました</AlertTitle>
                        {snackbarMessage}
                    </Alert>
                </Snackbar>
            </Container>
        </div>
    )
}

export default IndexPopup
