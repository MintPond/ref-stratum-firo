'use strict';

const
    EventEmitter = require('events'),
    precon = require('@mintpond/mint-precon'),
    Counter = require('@mintpond/mint-utils').Counter,
    Job = require('./class.Job');


class JobManager extends EventEmitter {

    /**
     * Constructor.
     *
     * @param args
     * @param args.stratum {Stratum}
     */
    constructor(args) {
        precon.notNull(args.stratum, 'stratum');

        super();

        const _ = this;
        _._stratum = args.stratum;

        _._currentJob = null;
        _._validJobsOMap = {};
        _._jobCounter = new Counter();
        _._jobInterval = null;
        _._blockInterval = null;
    }


    /**
     * The name of the event emitted when a new job is started.
     */
    static get EVENT_NEXT_JOB() { return 'nextJob'; }


    /**
     * Get the most recent Job created.
     * @returns {Job}
     */
    get currentJob() { return this._currentJob; }

    /**
     * An object map of valid Job instances by job ID.
     * @returns {{...}}
     */
    get validJobsOMap() { return this._validJobsOMap; }


    /**
     * Initialize job manager.
     *
     * @param [callback] {function()}
     */
    init(callback) {
        const _ = this;
        _.updateJob(() => {
            _._scheduleJobUpdate();
            _._scheduleBlockPolling();
            callback && callback();
        });
    }


    /**
     * Destroy job manager.
     */
    destroy() {
        const _ = this;
        clearInterval(_._jobInterval);
        clearTimeout(_._blockInterval);
    }


    /**
     * Notify the job manager of a new block on the network.
     */
    blockNotify() {

        const _ = this;

        _._getBlockTemplate((err, blockTemplate) => {
            if (err) {
                console.error(`Failed to get block template for new block: ${JSON.stringify(err)}`);
            }
            else if (blockTemplate) {
                _._processTemplate(blockTemplate);
            }
        });
    }


    /**
     * Update miners with a new job containing latest transactions.
     *
     * @param [callback] {function(err:*,currentJob:Job)}
     */
    updateJob(callback) {
        precon.opt_funct(callback, 'callback');

        const _ = this;
        _._getBlockTemplate((err, blockTemplate) => {
            if (err) {
                console.error(`Failed to get block template for job update: ${JSON.stringify(err)}`);
                callback && callback(err, _.currentJob);
            }
            else {
                _._processTemplate(blockTemplate, () => {
                    callback && callback(err, _.currentJob);
                });
            }
        });
    }


    _getBlockTemplate(callback) {
        const _ = this;
        _._stratum.rpcClient.cmd({
            method: 'getblocktemplate',
            params: [{
                capabilities: [
                    'coinbasetxn',
                    'workid',
                    'coinbase/append'
                ],
                rules: ['segwit']
            }],
            callback: callback
        });
    }


    _processTemplate(blockTemplate, callback) {

        const _ = this;
        const currentJob = _.currentJob;
        const isNewBlock = !currentJob || currentJob.prevBlockId !== blockTemplate.previousblockhash;

        if (currentJob && blockTemplate.height < currentJob.height) {
            callback && callback();
            return;
        }

        _._nextJob(blockTemplate, isNewBlock);

        callback && callback();
    }


    _nextJob(blockTemplate, isNew) {

        const _ = this;

        const job = _._createJob(_._jobCounter.nextHex32().toLowerCase(), blockTemplate);

        _._currentJob = job;

        if (isNew)
            _._validJobsOMap = {};

        _._validJobsOMap[job.idHex] = job;

        _._scheduleJobUpdate();

        _.emit(JobManager.EVENT_NEXT_JOB, { job: job, isNewBlock: isNew });
    }


    _createJob(idHex, blockTemplate) {
        const _ = this;
        return new Job({
            idHex: idHex,
            blockTemplate: blockTemplate,
            stratum: _._stratum
        });
    }


    _scheduleJobUpdate() {
        const _ = this;
        clearInterval(_._jobInterval);
        _._jobInterval = setInterval(() => {

            _.updateJob();

        }, (_._stratum.config.jobUpdateInterval || 55) * 1000);
    }

    _scheduleBlockPolling() {
        const _ = this;
        const blockPollIntervalMs = _._stratum.config.blockPollIntervalMs;

        if (!blockPollIntervalMs)
            return;

        clearTimeout(_._blockInterval);
        _._blockInterval = setTimeout(_._pollBlockTemplate.bind(_), blockPollIntervalMs);
    }


    _pollBlockTemplate() {
        const _ = this;
        _._getBlockTemplate((err, blockTemplate) => {

            if (blockTemplate) {

                const isNewBlock = !_.currentJob || _.currentJob.blockTemplate.previousblockhash !== blockTemplate.previousblockhash;
                if (isNewBlock)
                    _._processTemplate(blockTemplate);
            }

            _._scheduleBlockPolling();
        });
    }
}

module.exports = JobManager;